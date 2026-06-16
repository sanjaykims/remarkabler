import { describe, it, expect, beforeAll } from "vitest";

// The OAuth authorise URL is one of the few pure pieces of lib/dropbox.ts —
// no network, no DB, just URL construction. Lock the contract so any future
// edit that drops a required param surfaces here (especially
// token_access_type=offline, which is what gets us a refresh_token instead
// of a useless 4-hour access_token).

beforeAll(() => {
  process.env.DROPBOX_APP_KEY = "test_app_key";
  process.env.DROPBOX_APP_SECRET = "test_app_secret";
});

describe("buildAuthUrl", () => {
  it("includes the app key, redirect URI, response type, state, and offline flag", async () => {
    const { buildAuthUrl } = await import("@/lib/dropbox");
    const url = new URL(
      buildAuthUrl("https://example.com/api/dropbox/callback", "abc123")
    );
    expect(url.origin + url.pathname).toBe(
      "https://www.dropbox.com/oauth2/authorize"
    );
    expect(url.searchParams.get("client_id")).toBe("test_app_key");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.com/api/dropbox/callback"
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("abc123");
    // Critical: offline = we get a refresh_token in the exchange response.
    // Without this we'd get a 4-hour access token and the watcher would die
    // every afternoon.
    expect(url.searchParams.get("token_access_type")).toBe("offline");
  });

  it("URL-encodes the redirect_uri so callback URLs with query strings survive", async () => {
    const { buildAuthUrl } = await import("@/lib/dropbox");
    const url = new URL(
      buildAuthUrl("https://example.com/cb?x=1&y=2", "s")
    );
    // The decoded value must round-trip exactly.
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.com/cb?x=1&y=2"
    );
  });
});
