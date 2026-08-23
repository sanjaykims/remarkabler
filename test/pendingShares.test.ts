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
    ).toThrow(/valid PDF/);
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
