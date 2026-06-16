import { describe, it, expect } from "vitest";
import {
  classifyDropboxError,
  isPollLevelError,
  safeDropboxError,
} from "@/lib/dropbox";

// The whole point of error classification is deciding whether a Dropbox
// failure should kill the poll (auth/rate-limit/network/5xx) or be quietly
// skipped (per-file 404, malformed path). The previous code swallowed every
// error, so a revoked token looked like a successful empty poll. These
// tests lock the distinction so it can't silently regress.

describe("classifyDropboxError", () => {
  it("classifies 401 / 403 as auth", () => {
    expect(classifyDropboxError(401)).toBe("auth");
    expect(classifyDropboxError(403)).toBe("auth");
  });

  it("classifies 429 as rate-limit", () => {
    expect(classifyDropboxError(429)).toBe("rate-limit");
  });

  it("classifies 5xx as transient", () => {
    expect(classifyDropboxError(500)).toBe("transient");
    expect(classifyDropboxError(503)).toBe("transient");
    expect(classifyDropboxError(599)).toBe("transient");
  });

  it("treats 409 with path-style summary as file-local", () => {
    expect(classifyDropboxError(409, "path/not_found/.")).toBe("file-local");
    expect(classifyDropboxError(409, "path_lookup/not_found/.")).toBe(
      "file-local"
    );
  });

  it("treats 409 without recognisable summary as unknown (surfaces, not swallowed)", () => {
    // If we can't recognise it, default to unknown — better to surface a
    // false alarm than to silently swallow a systemic error.
    expect(classifyDropboxError(409, "some_other_thing/oops")).toBe("unknown");
    expect(classifyDropboxError(409)).toBe("unknown");
  });

  it("classifies 400 / 404 as file-local", () => {
    expect(classifyDropboxError(400)).toBe("file-local");
    expect(classifyDropboxError(404)).toBe("file-local");
  });
});

describe("isPollLevelError", () => {
  it("treats auth, rate-limit, transient, unknown as poll-level (trips backoff)", () => {
    expect(isPollLevelError("auth")).toBe(true);
    expect(isPollLevelError("rate-limit")).toBe(true);
    expect(isPollLevelError("transient")).toBe(true);
    expect(isPollLevelError("unknown")).toBe(true);
  });

  it("treats file-local as not poll-level (skip and continue)", () => {
    expect(isPollLevelError("file-local")).toBe(false);
  });
});

describe("safeDropboxError", () => {
  it("never includes any provider response body for token endpoints", () => {
    const msg = safeDropboxError("token", 401);
    // Generic, status-coded, mentions the kind. No URL, no payload, no token.
    expect(msg).toMatch(/401/);
    expect(msg).toMatch(/auth/);
    expect(msg.toLowerCase()).not.toContain("bearer");
    expect(msg.toLowerCase()).not.toContain("authorization");
    expect(msg.toLowerCase()).not.toContain("client_secret");
    expect(msg.toLowerCase()).not.toContain("refresh_token");
  });

  it("ignores any supplied summary on token endpoints — defence in depth", () => {
    // Even if a future code path accidentally passed a body string here,
    // the token-endpoint branch should never include it.
    const msg = safeDropboxError("token", 400, "client_secret=ACTUALSECRET");
    expect(msg).not.toContain("ACTUALSECRET");
    expect(msg).not.toContain("client_secret=");
  });

  it("includes Dropbox's error_summary on file endpoints", () => {
    const msg = safeDropboxError("file", 409, "path/not_found/.");
    expect(msg).toMatch(/409/);
    expect(msg).toMatch(/file-local/);
    expect(msg).toContain("path/not_found");
  });

  it("truncates excessively long summaries", () => {
    const long = "x".repeat(500);
    const msg = safeDropboxError("file", 409, long);
    expect(msg.length).toBeLessThan(200);
  });
});
