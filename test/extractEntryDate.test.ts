import { describe, it, expect } from "vitest";
import { extractEntryDate } from "@/lib/notes";

// extractEntryDate was silently wrong for the whole early life of the app
// (it expected YYYY-MM-DD-HHMM-KST while the user writes YYYY-MM-DD-HH-MM-kst),
// which left every entry undated and the heatmap empty. These lock the
// accepted header formats so that regression can't come back unnoticed.
describe("extractEntryDate", () => {
  it("parses the user's real format: yyyy-mm-dd-hh-mm-kst (dash, lowercase)", () => {
    expect(extractEntryDate("2026-06-14-22-30-kst\nDear diary…")).toBe(
      "2026-06-14"
    );
  });

  it("parses the legacy compact form: yyyy-mm-dd-hhmm-KST", () => {
    expect(extractEntryDate("2026-06-14-2230-KST")).toBe("2026-06-14");
  });

  it("parses space + colon form: yyyy-mm-dd hh:mm KST", () => {
    expect(extractEntryDate("2026-06-14 22:30 KST")).toBe("2026-06-14");
  });

  it("parses ISO-ish T separator: yyyy-mm-ddThh:mmKST", () => {
    expect(extractEntryDate("2026-06-14T22:30KST")).toBe("2026-06-14");
  });

  it("is case-insensitive on the KST marker", () => {
    expect(extractEntryDate("2026-01-02-09-05-KsT")).toBe("2026-01-02");
  });

  it("finds the header even with leading whitespace/content lines", () => {
    expect(extractEntryDate("   \n2026-12-31-08-00-kst rest")).toBe(
      "2026-12-31"
    );
  });

  it("returns null when there is no timestamp header", () => {
    expect(extractEntryDate("Just some notes with no date.")).toBeNull();
  });

  it("returns null for empty/whitespace text", () => {
    expect(extractEntryDate("")).toBeNull();
    expect(extractEntryDate("   \n  ")).toBeNull();
  });

  it("does not match a bare date with no KST marker", () => {
    // A plain date is ambiguous (could be any date written mid-entry); the
    // header convention requires the KST marker.
    expect(extractEntryDate("met on 2026-06-14 for lunch")).toBeNull();
  });
});
