import { beforeAll, describe, expect, it } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { NextRequest } from "next/server";

let nb: typeof import("../lib/notebooksPin");
let map: typeof import("../lib/mapPin");

beforeAll(async () => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "nbpin-"));
  nb = await import("../lib/notebooksPin");
  map = await import("../lib/mapPin");
});

function reqWithCookie(token?: string): NextRequest {
  return new NextRequest("http://localhost/api/notebooks", {
    headers: token ? { cookie: `${nb.NOTEBOOKS_UNLOCK_COOKIE}=${token}` } : {},
  });
}

describe("notebooks PIN with a real settings table", () => {
  it("fails closed until a PIN exists, then unlocks, locks out and rotates", () => {
    expect(nb.notebooksPinConfigured()).toBe(false);
    // No PIN yet: even a minted token must not open the routes.
    expect(nb.notebooksPinDenied(reqWithCookie(nb.makeNotebooksUnlockToken()))?.status).toBe(403);

    nb.setNotebooksPin("2468");
    expect(nb.notebooksPinConfigured()).toBe(true);
    expect(nb.notebooksPinDenied(reqWithCookie())?.status).toBe(403);

    const tok = nb.makeNotebooksUnlockToken();
    expect(nb.notebooksPinDenied(reqWithCookie(tok))).toBeNull();
    expect(nb.notebooksPinDenied(reqWithCookie(tok + "0"))?.status).toBe(403);
    expect(
      nb.notebooksPinDenied(reqWithCookie(nb.makeNotebooksUnlockToken(Date.now() - 11 * 60e3)))?.status
    ).toBe(403); // expired

    expect(nb.tryUnlockNotebooks("2468").ok).toBe(true);
    for (let i = 0; i < 5; i++) expect(nb.tryUnlockNotebooks("0000").ok).toBe(false);
    expect(nb.notebooksPinLockRemainingMs()).toBeGreaterThan(0);
    expect(nb.tryUnlockNotebooks("2468").ok).toBe(false); // locked even for the right PIN

    // Changing the PIN revokes old unlocks and clears the lockout.
    nb.setNotebooksPin("1357");
    expect(nb.notebooksPinDenied(reqWithCookie(tok))?.status).toBe(403);
    expect(nb.notebooksPinLockRemainingMs()).toBe(0);
    expect(nb.tryUnlockNotebooks("1357").ok).toBe(true);
  });

  it("is fully independent of the Map PIN", () => {
    map.setMapPin("1357"); // same digits on purpose
    const nbTok = nb.makeNotebooksUnlockToken();
    const mapTok = map.makeUnlockToken();
    // A token from one gate never validates on the other.
    expect(map.verifyUnlockToken(nbTok)).toBe(false);
    expect(nb.verifyNotebooksUnlockToken(mapTok)).toBe(false);
    // Locking out one gate leaves the other usable.
    for (let i = 0; i < 5; i++) nb.tryUnlockNotebooks("0000");
    expect(nb.notebooksPinLockRemainingMs()).toBeGreaterThan(0);
    expect(map.mapPinLockRemainingMs()).toBe(0);
    expect(map.tryUnlock("1357").ok).toBe(true);
    // Cookie scopes differ.
    expect(nb.notebooksUnlockCookieOptions.path).toBe("/api");
    expect(map.mapUnlockCookieOptions.path).toBe("/api/map");
  });
});

describe("every Notebooks-tab data route is PIN-gated", () => {
  const routes = [
    "app/api/notebooks/route.ts",
    "app/api/notebooks/duplicates/route.ts",
    "app/api/notebooks/[id]/pages/route.ts",
    "app/api/notebooks/[id]/pdf/route.ts",
    "app/api/shares/route.ts",
    "app/api/shares/[id]/pdf/route.ts",
    "app/api/ocr-review/route.ts",
    "app/api/ocr-review/backfill/route.ts",
  ];
  for (const r of routes) {
    it(`${r} calls notebooksPinDenied in every handler`, () => {
      const src = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      const handlers = (src.match(/export async function (GET|POST|PATCH|DELETE|PUT)\b/g) || []).length;
      const guards = (src.match(/notebooksPinDenied\(req\)/g) || []).length;
      expect(handlers).toBeGreaterThan(0);
      expect(guards).toBe(handlers);
    });
  }
});
