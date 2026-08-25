import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { NextRequest } from "next/server";

type DbMod = typeof import("@/lib/db");
type PendingMod = typeof import("@/lib/pendingShares");
type NotesMod = typeof import("@/lib/notes");
type ShareRoute = typeof import("@/app/share/route");

let dataDir: string;
let dbMod: DbMod;
let pendingMod: PendingMod;
let notesMod: NotesMod;
let shareRoute: ShareRoute;

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "remarkabler-pending-share-"));
  process.env.DATA_DIR = dataDir;
  delete process.env.VOYAGE_API_KEY;
  dbMod = await import("@/lib/db");
  pendingMod = await import("@/lib/pendingShares");
  notesMod = await import("@/lib/notes");
  shareRoute = await import("@/app/share/route");
  dbMod.db();
});

beforeEach(() => {
  const d = dbMod.db();
  d.prepare(`DELETE FROM pending_shares`).run();
  d.prepare(`DELETE FROM share_rate_events`).run();
  d.prepare(`DELETE FROM notebooks`).run();
  rmSync(path.join(dataDir, "pending-shares"), { recursive: true, force: true });
  rmSync(path.join(dataDir, "files"), { recursive: true, force: true });
});

describe("public share quarantine", () => {
  it("persists a valid PDF without creating a notebook", async () => {
    const form = new FormData();
    form.append("file", new File([pdf], "journal.pdf", { type: "application/pdf" }));
    const req = new NextRequest("http://localhost/share", {
      method: "POST",
      body: form,
      headers: { "x-real-ip": "203.0.113.5" },
    });

    const response = await shareRoute.POST(req);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("waiting safely for your approval");
    expect(pendingMod.listPendingShares()).toHaveLength(1);
    expect(
      (dbMod.db().prepare(`SELECT COUNT(*) AS c FROM notebooks`).get() as { c: number }).c
    ).toBe(0);
  });

  it("rejects bad magic bytes before quarantine", () => {
    expect(() =>
      pendingMod.createPendingShare({
        fileName: "fake.pdf",
        bytes: new Uint8Array([1, 2, 3, 4]),
        source: "test",
      })
    ).toThrow(/PDF header/);
    expect(pendingMod.listPendingShares()).toEqual([]);
  });

  it("uses a durable queued state and a deterministic approval id", () => {
    const pending = pendingMod.createPendingShare({
      fileName: "diary.pdf",
      bytes: pdf,
      source: "test",
    });
    const notebook = notesMod.createNotebook(
      pending.name,
      pendingMod.readPendingShare(pending.id)!.bytes,
      pending.notebookId
    );
    const row = dbMod
      .db()
      .prepare(`SELECT id, status FROM notebooks WHERE id = ?`)
      .get(notebook.id) as { id: string; status: string };

    expect(row).toEqual({ id: pending.notebookId, status: "queued" });
    expect(existsSync(path.join(dataDir, "files", row.id, "notebook.pdf"))).toBe(true);
  });

  it("caps the inert quarantine even when sources vary", () => {
    for (let i = 0; i < pendingMod.MAX_PENDING_SHARES; i++) {
      pendingMod.createPendingShare({
        fileName: `${i}.pdf`,
        bytes: pdf,
        source: `source-${i}`,
      });
    }
    expect(() =>
      pendingMod.createPendingShare({
        fileName: "overflow.pdf",
        bytes: pdf,
        source: "another-source",
      })
    ).toThrow(/storage is full/);
  });
});

describe("quarantine abuse resistance", () => {
  const share = (source: string, name = "note.pdf") =>
    pendingMod.createPendingShare({ fileName: name, bytes: pdf, source });

  it("stops one source from holding every pending slot", () => {
    // Five 8-byte requests used to be enough to occupy all MAX_PENDING_SHARES
    // slots and disable the owner's Android share sheet for the full retention
    // window — without ever tripping the rate limit, since 5 < SHARE_RATE_MAX.
    for (let i = 0; i < pendingMod.PER_SOURCE_PENDING_MAX; i++) {
      share("198.51.100.1", `a${i}.pdf`);
    }
    expect(() => share("198.51.100.1", "overflow.pdf")).toThrow(
      /Too many shares from this source/
    );

    // Capacity is reserved, so a genuine share still lands.
    expect(() => share("203.0.113.9", "real-diary.pdf")).not.toThrow();
  });

  it("counts REJECTED attempts toward the rate limit", () => {
    // Fill the source's slots so every later attempt is rejected...
    for (let i = 0; i < pendingMod.PER_SOURCE_PENDING_MAX; i++) {
      share("198.51.100.2", `b${i}.pdf`);
    }
    // ...then keep hammering. Rejections used to be free, because the rate
    // event was only written inside the success transaction.
    let rejected = 0;
    for (let i = 0; i < 20; i++) {
      try {
        share("198.51.100.2", `c${i}.pdf`);
      } catch (e) {
        rejected++;
        if (/Too many shares were received recently/.test((e as Error).message)) {
          break;
        }
      }
    }
    expect(rejected).toBeGreaterThan(0);
    // The throttle must eventually engage rather than accepting requests forever.
    expect(() => share("198.51.100.2", "final.pdf")).toThrow(
      /Too many shares were received recently/
    );
  });

  it("does not evict existing shares when the quarantine is full", () => {
    // Reject-don't-evict is the property that stops an attacker displacing the
    // owner's genuine share. Fill every slot from distinct sources.
    for (let i = 0; i < pendingMod.MAX_PENDING_SHARES; i++) {
      share(`10.0.0.${i}`, `d${i}.pdf`);
    }
    const before = pendingMod.listPendingShares();
    expect(before).toHaveLength(pendingMod.MAX_PENDING_SHARES);

    expect(() => share("10.0.9.9", "pushy.pdf")).toThrow();

    const after = pendingMod.listPendingShares();
    expect(after).toHaveLength(pendingMod.MAX_PENDING_SHARES);
    expect(after.map((s) => s.id).sort()).toEqual(
      before.map((s) => s.id).sort()
    );
  });

  it("enforces the aggregate byte cap, not just the count cap", () => {
    // Each file must stay under MAX_UPLOAD_BYTES (20 MB) so the PER-FILE cap
    // doesn't fire first; four 19 MB files exceed MAX_PENDING_BYTES (60 MB)
    // while the count is still only 3, isolating the aggregate check.
    const chunk = () => {
      const b = new Uint8Array(19 * 1024 * 1024);
      b.set([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
      return b;
    };
    const put = (source: string, name: string) =>
      pendingMod.createPendingShare({ fileName: name, bytes: chunk(), source });

    put("192.0.2.1", "big1.pdf");
    put("192.0.2.1", "big2.pdf");
    put("192.0.2.2", "big3.pdf");
    // 57 MB pending, 3 of 5 slots used — only the byte cap can stop this one.
    expect(() => put("192.0.2.3", "big4.pdf")).toThrow(/storage is full/);
  });
});

describe("pre-approval preview", () => {
  it("serves a quarantined PDF to the authenticated owner as an attachment", async () => {
    const route = await import("@/app/api/shares/[id]/pdf/route");
    const created = pendingMod.createPendingShare({
      fileName: "note.pdf",
      bytes: pdf,
      source: "203.0.113.5",
    });

    const res = await route.GET({} as never, {
      params: Promise.resolve({ id: created.id }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    // Never inline: rendering untrusted PDF bytes in a same-origin viewer
    // would hand an attacker a parser surface on the origin holding the
    // session cookie.
    expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("404s for an unknown id", async () => {
    const route = await import("@/app/api/shares/[id]/pdf/route");
    const res = await route.GET({} as never, {
      params: Promise.resolve({ id: "does-not-exist" }),
    });
    expect(res.status).toBe(404);
  });

  it("strips bidi and zero-width characters from the displayed name", () => {
    // A hostile share can otherwise render as a filename the owner expects.
    const created = pendingMod.createPendingShare({
      fileName: "Journal‮2026.pdf​",
      bytes: pdf,
      source: "203.0.113.6",
    });
    expect(created.name).not.toMatch(/[​-‏‪-‮⁦-⁩﻿]/);
    expect(created.name).toContain("Journal");
  });
});

describe("PDF header tolerance", () => {
  it("accepts a PDF whose header is preceded by a BOM", async () => {
    const { looksLikePdf } = await import("@/lib/upload");
    // Requiring offset 0 rejected legitimate exports with a leading BOM, with
    // no diagnostic — and on the share path a false rejection loses the file.
    const withBom = new Uint8Array([
      0xef, 0xbb, 0xbf, 0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
    ]);
    expect(looksLikePdf(withBom)).toBe(true);
  });

  it("still rejects a file with no PDF header at all", async () => {
    const { looksLikePdf } = await import("@/lib/upload");
    expect(looksLikePdf(new Uint8Array(2048))).toBe(false);
    expect(looksLikePdf(new TextEncoder().encode("<html></html>"))).toBe(false);
  });

  it("does not scan beyond the first 1024 bytes", async () => {
    const { looksLikePdf } = await import("@/lib/upload");
    const late = new Uint8Array(4096);
    late.set([0x25, 0x50, 0x44, 0x46, 0x2d], 2000);
    expect(looksLikePdf(late)).toBe(false);
  });
});
