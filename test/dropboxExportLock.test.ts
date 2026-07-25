import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

type DbMod = typeof import("@/lib/db");
type DropboxMod = typeof import("@/lib/dropbox");
type ConversationWikiMod = typeof import("@/lib/conversationWiki");
type DiaryExportDbMod = typeof import("@/lib/diaryExportDb");

let dbMod: DbMod;
let dropbox: DropboxMod;
let conversationWiki: ConversationWikiMod;
let diaryExportDb: DiaryExportDbMod;

type UploadCall = {
  path: string;
  body: string;
};

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "dropbox-export-lock-"));
  dbMod = await import("@/lib/db");
  dropbox = await import("@/lib/dropbox");
  conversationWiki = await import("@/lib/conversationWiki");
  diaryExportDb = await import("@/lib/diaryExportDb");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.DROPBOX_APP_KEY;
  delete process.env.DROPBOX_APP_SECRET;
  dbMod.db().exec(`
    DELETE FROM entity_relationships;
    DELETE FROM entity_conversation_notes;
    DELETE FROM entity_wiki;
    DELETE FROM entry_entities;
    DELETE FROM mcp_conversations;
    DELETE FROM pages;
    DELETE FROM notebooks;
    DELETE FROM settings;
  `);
});

function resetDropboxState(): void {
  process.env.DROPBOX_APP_KEY = "test-key";
  process.env.DROPBOX_APP_SECRET = "test-secret";
  dbMod.setSetting("dropbox_refresh_token", "refresh-token");
  dbMod.setSetting("dropbox_export_enabled", "1");
  dbMod.setSetting("dropbox_export_folder", "/Remarkabler/test-vault");
  dbMod
    .db()
    .prepare("INSERT INTO notebooks(id, name, synced_at) VALUES(?, ?, ?)")
    .run("n1", "Journal", new Date().toISOString());
  dbMod
    .db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date)
       VALUES(?, ?, ?, ?, ?)`
    )
    .run("p1", "n1", 0, "2026-07-25-0900-KST\nJin lives in Suwon.", "2026-07-25");
}

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function mockDropboxFetch(blockFirstUpload = false): {
  uploads: UploadCall[];
  firstUploadStarted: Promise<void>;
  releaseFirstUpload: () => void;
} {
  const uploads: UploadCall[] = [];
  const started = deferred();
  const release = deferred();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "access-token", expires_in: 3600 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (href.endsWith("/2/files/upload")) {
        const headers = init?.headers as Record<string, string>;
        const arg = JSON.parse(headers["Dropbox-API-Arg"]) as { path: string };
        uploads.push({ path: arg.path, body: String(init?.body ?? "") });
        if (blockFirstUpload && uploads.length === 1) {
          started.resolve();
          await release.promise;
        }
        return new Response("", { status: 200 });
      }
      throw new Error(`Unexpected Dropbox fetch: ${href}`);
    })
  );
  return {
    uploads,
    firstUploadStarted: started.promise,
    releaseFirstUpload: release.resolve,
  };
}

async function waitUntil(
  predicate: () => boolean,
  timeoutMs = 3000
): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function expectedFullDiaryExportCount(): number {
  return new Map<string, string>([
    ...diaryExportDb.renderDiaryDayFiles(),
    ...diaryExportDb.renderEntityStubFiles(),
    ...diaryExportDb.renderVaultStructureFiles(),
  ]).size;
}

describe("maybeExportDiaryToDropbox shared lock", () => {
  it("does not schedule a follow-up when nothing is skipped during export", async () => {
    resetDropboxState();
    const { uploads } = mockDropboxFetch();

    await expect(
      dropbox.maybeExportDiaryToDropbox({ onlyNewest: true })
    ).resolves.toMatchObject({ ok: true, written: 1 });
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(uploads.map((u) => u.path)).toEqual([
      "/Remarkabler/test-vault/2026-07-25.md",
    ]);
  });

  it("coalesces one skipped diary export into a guaranteed follow-up run", async () => {
    resetDropboxState();
    const { uploads, firstUploadStarted, releaseFirstUpload } =
      mockDropboxFetch(true);
    const active = dropbox.maybeExportDiaryToDropbox({ onlyNewest: true });

    await firstUploadStarted;
    await expect(
      dropbox.maybeExportDiaryToDropbox({ onlyEntityStubs: [] })
    ).resolves.toMatchObject({ ok: false, skipped: "in-flight" });

    const expectedUploads = 1 + expectedFullDiaryExportCount();
    releaseFirstUpload();
    await expect(active).resolves.toMatchObject({ ok: true, written: 1 });
    await waitUntil(() => uploads.length === expectedUploads);

    expect(uploads[0].path).toBe("/Remarkabler/test-vault/2026-07-25.md");
    expect(uploads.slice(1).some((u) => u.path.endsWith("/Home.md"))).toBe(true);
  });

  it("collapses multiple skipped diary exports into one full follow-up", async () => {
    resetDropboxState();
    const { uploads, firstUploadStarted, releaseFirstUpload } =
      mockDropboxFetch(true);
    const active = dropbox.maybeExportDiaryToDropbox({ onlyNewest: true });

    await firstUploadStarted;
    await dropbox.maybeExportDiaryToDropbox({ onlyEntityStubs: [] });
    await dropbox.maybeExportDiaryToDropbox({ notebookId: "n1" });

    const expectedUploads = 1 + expectedFullDiaryExportCount();
    releaseFirstUpload();
    await active;
    await waitUntil(() => uploads.length === expectedUploads);
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(uploads.length).toBe(expectedUploads);
  });

  it("runs the pending diary follow-up after a different exporter releases the lock", async () => {
    resetDropboxState();
    conversationWiki.saveExportedConversation({
      content: "User: Jin lives in Suwon.",
      conversationId: "conv-lock",
    });
    const { uploads, firstUploadStarted, releaseFirstUpload } =
      mockDropboxFetch(true);
    const active = dropbox.maybeExportConversationsToDropbox();

    await firstUploadStarted;
    await expect(
      dropbox.maybeExportDiaryToDropbox({ onlyNewest: true })
    ).resolves.toMatchObject({ ok: false, skipped: "in-flight" });

    releaseFirstUpload();
    await expect(active).resolves.toMatchObject({ ok: true, written: 1 });
    await waitUntil(() => uploads.length === 1 + expectedFullDiaryExportCount());

    expect(uploads[0].path).toContain("/Conversations/");
    expect(uploads.some((u) => u.path === "/Remarkabler/test-vault/2026-07-25.md")).toBe(
      true
    );
  });
});
