import { describe, it, expect } from "vitest";
import { cleanEntityWiki } from "@/lib/claude";

// Pure tidy-up of a Claude-written entity profile body: strip a stray code
// fence or leading heading (the page supplies its own H1), collapse blank
// runs, cap length, null for empty.

describe("cleanEntityWiki", () => {
  it("returns a plain paragraph unchanged", () => {
    expect(cleanEntityWiki("Jin is a close friend from Wuhan.")).toBe(
      "Jin is a close friend from Wuhan."
    );
  });

  it("strips a ```markdown fence", () => {
    expect(cleanEntityWiki("```markdown\nA profile.\n```")).toBe("A profile.");
  });

  it("drops a leading H1/H2 the model added despite instructions", () => {
    expect(cleanEntityWiki("# Jin\n\nThe actual profile line.")).toBe(
      "The actual profile line."
    );
    expect(cleanEntityWiki("## Seoul\n\nA place profile.")).toBe(
      "A place profile."
    );
  });

  it("keeps bullet lists and collapses excess blank lines", () => {
    const out = cleanEntityWiki("Intro line.\n\n\n\n- fact one\n- fact two");
    expect(out).toBe("Intro line.\n\n- fact one\n- fact two");
  });

  it("returns null for empty / whitespace / fence-only", () => {
    expect(cleanEntityWiki("")).toBeNull();
    expect(cleanEntityWiki("   \n  ")).toBeNull();
    expect(cleanEntityWiki("```\n```")).toBeNull();
  });

  it("caps very long output", () => {
    const long = "x".repeat(5000);
    const out = cleanEntityWiki(long) as string;
    expect(out.length).toBeLessThanOrEqual(2000);
  });
});
