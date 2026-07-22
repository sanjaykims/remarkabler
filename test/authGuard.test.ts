import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

// Regression guard: every data API route must gate behind the app lock.
//
// Enforcement is currently per-route (each handler calls `isAuthenticated()`
// or the shared `requireAuth()` helper). Coverage is complete today, but
// nothing stops a *new* route.ts from shipping without the check — which would
// silently expose the diary. This test walks app/api/**/route.ts and asserts
// each file references a guard, unless it's on an explicit PUBLIC allowlist.
//
// A route may only join the allowlist if it MUST be reachable without a
// session AND carries its own auth. Adding a route here is a deliberate
// security decision — do not add one just to make this test pass.
const PUBLIC: ReadonlySet<string> = new Set([
  // The login endpoint itself — can't require a session to create one.
  "auth/route.ts",
  // The remote MCP endpoint — guarded by its own MCP_AUTH_TOKEN bearer check
  // (lib/mcp.ts), deliberately bypassing the cookie/passkey lock.
  "mcp/route.ts",
  // OAuth 2.1 handshake endpoints — must be reachable pre-auth so the
  // claude.ai connector can complete discovery → DCR → authorize → token.
  // The security anchor is the consent gate on /authorize (lib/mcpOauth.ts).
  "mcp/oauth/authorization-server/route.ts",
  "mcp/oauth/authorize/route.ts",
  "mcp/oauth/protected-resource/route.ts",
  "mcp/oauth/register/route.ts",
  "mcp/oauth/token/route.ts",
  // CSP violation sink — browsers POST reports here with no session; it only
  // logs, never reads app data.
  "csp-report/route.ts",
]);

const GUARD_RE = /isAuthenticated|requireAuth/;

function findRouteFiles(dir: string, base: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...findRouteFiles(full, base));
    } else if (entry === "route.ts") {
      out.push(path.relative(base, full).split(path.sep).join("/"));
    }
  }
  return out;
}

describe("API route auth coverage", () => {
  const apiDir = path.join(process.cwd(), "app", "api");
  const routes = findRouteFiles(apiDir, apiDir).sort();

  it("finds the API routes (sanity)", () => {
    expect(routes.length).toBeGreaterThan(20);
  });

  it("every non-public route references a lock guard", () => {
    const missing = routes.filter((rel) => {
      if (PUBLIC.has(rel)) return false;
      const src = readFileSync(path.join(apiDir, rel), "utf8");
      return !GUARD_RE.test(src);
    });
    expect(missing, `unguarded API routes (add a guard or justify on the PUBLIC allowlist): ${missing.join(", ")}`).toEqual([]);
  });

  it("every PUBLIC-allowlisted route still exists (no stale entries)", () => {
    const stale = [...PUBLIC].filter((rel) => !routes.includes(rel));
    // csp-report is added in the same change that creates its route; allow it
    // to be pending until that file lands.
    const pendingOk = stale.filter((rel) => rel !== "csp-report/route.ts");
    expect(pendingOk, `stale PUBLIC entries: ${pendingOk.join(", ")}`).toEqual([]);
  });
});
