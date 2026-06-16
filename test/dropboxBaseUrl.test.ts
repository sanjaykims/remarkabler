import { describe, it, expect, beforeEach, afterEach } from "vitest";

// In production with Dropbox configured, the OAuth redirect URI must come
// from a canonical APP_BASE_URL env var — NOT from request headers (which a
// misconfigured proxy could let an attacker influence). In dev we honour
// forwarded headers so localhost works without ceremony. This is the
// "fail-closed in production" stance Codex pushed for.

const originalNodeEnv = process.env.NODE_ENV;
const originalBaseUrl = process.env.APP_BASE_URL;

function fakeHeaders(map: Record<string, string>) {
  return {
    get(name: string): string | null {
      return map[name.toLowerCase()] ?? null;
    },
  };
}

describe("resolveAppBaseUrl", () => {
  beforeEach(() => {
    delete process.env.APP_BASE_URL;
  });
  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else (process.env as Record<string, string>).NODE_ENV = originalNodeEnv;
    if (originalBaseUrl === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = originalBaseUrl;
  });

  it("uses APP_BASE_URL when set, stripping trailing slash", async () => {
    process.env.APP_BASE_URL = "https://app.example.com/";
    const { resolveAppBaseUrl } = await import("@/lib/dropbox");
    const r = resolveAppBaseUrl(fakeHeaders({ host: "ignored" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.baseUrl).toBe("https://app.example.com");
  });

  it("FAILS CLOSED in production when APP_BASE_URL is missing", async () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    const { resolveAppBaseUrl } = await import("@/lib/dropbox");
    const r = resolveAppBaseUrl(
      fakeHeaders({ host: "anything.example.com", "x-forwarded-host": "anything.example.com" })
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/APP_BASE_URL/);
  });

  it("falls back to forwarded headers in development", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    const { resolveAppBaseUrl } = await import("@/lib/dropbox");
    const r = resolveAppBaseUrl(
      fakeHeaders({
        host: "localhost:3000",
        "x-forwarded-host": "preview.example.dev",
        "x-forwarded-proto": "https",
      })
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.baseUrl).toBe("https://preview.example.dev");
  });

  it("falls back to host header in development when no forwarded proto", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    const { resolveAppBaseUrl } = await import("@/lib/dropbox");
    const r = resolveAppBaseUrl(fakeHeaders({ host: "localhost:3001" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.baseUrl).toBe("http://localhost:3001");
  });

  it("errors in dev when there are no headers at all", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    const { resolveAppBaseUrl } = await import("@/lib/dropbox");
    const r = resolveAppBaseUrl(fakeHeaders({}));
    expect(r.ok).toBe(false);
  });

  // Codex's optional cleanup: validate the configured value so a misformed
  // APP_BASE_URL is caught at startup rather than producing a confusing
  // Dropbox redirect error.
  it("rejects an unparseable APP_BASE_URL", async () => {
    process.env.APP_BASE_URL = "not a url";
    const { resolveAppBaseUrl } = await import("@/lib/dropbox");
    const r = resolveAppBaseUrl(fakeHeaders({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not a valid URL/i);
  });

  it("rejects an APP_BASE_URL with a non-http(s) scheme", async () => {
    process.env.APP_BASE_URL = "ftp://example.com";
    const { resolveAppBaseUrl } = await import("@/lib/dropbox");
    const r = resolveAppBaseUrl(fakeHeaders({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/http or https/i);
  });

  it("rejects an http APP_BASE_URL in production (would leak the OAuth code)", async () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.APP_BASE_URL = "http://example.com";
    const { resolveAppBaseUrl } = await import("@/lib/dropbox");
    const r = resolveAppBaseUrl(fakeHeaders({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/https in production/i);
  });

  it("rejects an APP_BASE_URL with a path component", async () => {
    process.env.APP_BASE_URL = "https://example.com/sub/path";
    const { resolveAppBaseUrl } = await import("@/lib/dropbox");
    const r = resolveAppBaseUrl(fakeHeaders({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/path/i);
  });

  it("rejects an APP_BASE_URL with a query string", async () => {
    // "https://example.com?x=1" + "/api/dropbox/callback" would produce a
    // broken redirect_uri — reject at validation time.
    process.env.APP_BASE_URL = "https://example.com?x=1";
    const { resolveAppBaseUrl } = await import("@/lib/dropbox");
    const r = resolveAppBaseUrl(fakeHeaders({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/query/i);
  });

  it("rejects an APP_BASE_URL with a URL fragment", async () => {
    process.env.APP_BASE_URL = "https://example.com#section";
    const { resolveAppBaseUrl } = await import("@/lib/dropbox");
    const r = resolveAppBaseUrl(fakeHeaders({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/fragment/i);
  });

  it("accepts http APP_BASE_URL in development for localhost convenience", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    process.env.APP_BASE_URL = "http://localhost:3001";
    const { resolveAppBaseUrl } = await import("@/lib/dropbox");
    const r = resolveAppBaseUrl(fakeHeaders({}));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.baseUrl).toBe("http://localhost:3001");
  });
});
