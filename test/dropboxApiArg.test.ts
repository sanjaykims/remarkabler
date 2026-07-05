import { describe, it, expect } from "vitest";
import { dropboxApiArg } from "@/lib/dropbox";

// The Dropbox-API-Arg HTTP header must be ASCII-only. A file path with
// non-ASCII characters (e.g. a Korean entity-stub name like People/김철수.md)
// would otherwise make fetch throw "Cannot convert argument to a ByteString"
// — the bug that failed 124 entity-stub uploads on the live app.
describe("dropboxApiArg", () => {
  it("leaves an all-ASCII arg unchanged (still valid JSON)", () => {
    const s = dropboxApiArg({ path: "/Diary/2026-06-19.md", mode: "overwrite" });
    expect(s).toBe('{"path":"/Diary/2026-06-19.md","mode":"overwrite"}');
  });

  it("escapes Korean characters in a path to \\uXXXX", () => {
    const s = dropboxApiArg({ path: "/Diary/People/김.md" });
    // 김 = U+AE40; must not appear raw, must appear escaped.
    expect(s).not.toContain("김");
    expect(s).toContain("\\uae40");
  });

  it("produces a header value with no byte above 0x7f", () => {
    const s = dropboxApiArg({ path: "/People/서울: 강남/프로젝트.md" });
    for (let i = 0; i < s.length; i++) {
      expect(s.charCodeAt(i)).toBeLessThanOrEqual(0x7f);
    }
  });

  it("round-trips back to the original object via JSON.parse", () => {
    const original = { path: "/People/김철수.md", mode: "overwrite", mute: true };
    expect(JSON.parse(dropboxApiArg(original))).toEqual(original);
  });
});
