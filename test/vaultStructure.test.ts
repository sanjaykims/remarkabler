import { describe, it, expect } from "vitest";
import {
  buildHomeNote,
  buildEntityIndexNote,
  buildProfileNote,
  entityIndexFileName,
  HOME_FILE,
  PROFILE_FILE,
  type HomeStats,
} from "@/lib/diaryExport";

// The vault-structure "second brain" notes (Home dashboard, per-kind index
// MOCs, Profile) are pure builders — no DB/IO — so they unit-test directly,
// mirroring test/diaryExport.test.ts. These pins lock:
//   - fixed vault-root filenames + stable wikilink targets;
//   - counts and links render correctly;
//   - index sorts by mention count then name, and labels conversation/
//     reflection-only entities distinctly;
//   - empty-diary / no-profile edges degrade cleanly.

const STATS: HomeStats = {
  diaryDays: 12,
  people: 3,
  places: 2,
  projects: 4,
  reflections: 1,
  conversations: 5,
  decisions: 2,
};

describe("filenames", () => {
  it("are fixed vault-root notes", () => {
    expect(HOME_FILE).toBe("Home.md");
    expect(PROFILE_FILE).toBe("Profile.md");
    expect(entityIndexFileName("person")).toBe("People.md");
    expect(entityIndexFileName("place")).toBe("Places.md");
    expect(entityIndexFileName("project")).toBe("Projects.md");
  });
});

describe("buildHomeNote", () => {
  it("renders counts and quick links to the index + profile notes", () => {
    const md = buildHomeNote({
      stats: STATS,
      recentDays: [{ target: "2026-07-19", label: "2026-07-19" }],
      recentReflections: [{ target: "2026-07-19-Reflecting-abc123", label: "Reflecting" }],
      recentConversations: [],
      recentDecisions: [{ target: "2026-07-18-Defer-ETF-def456", label: "Defer ETF" }],
      hasProfile: true,
      exportedAt: "2026-07-20 10:00",
    });
    expect(md).toContain("# Home");
    expect(md).toContain("Diary days**: 12");
    expect(md).toContain("[[People]]: 3");
    expect(md).toContain("[[Projects]]: 4");
    expect(md).toContain("Decisions**: 2");
    // Quick-link section resolves to the real index notes + profile.
    expect(md).toContain("- [[People]]");
    expect(md).toContain("- [[Profile]]");
    // Recent items link by bare basename, reflections aliased to their title.
    expect(md).toContain("- [[2026-07-19]]");
    expect(md).toContain("- [[2026-07-19-Reflecting-abc123|Reflecting]]");
    expect(md).toContain("## Recent decisions");
    expect(md).toContain("- [[2026-07-18-Defer-ETF-def456|Defer ETF]]");
    // No conversations → that section is omitted entirely.
    expect(md).not.toContain("## Recent conversations");
  });

  it("omits the Profile link when there's no profile", () => {
    const md = buildHomeNote({
      stats: STATS,
      recentDays: [],
      recentReflections: [],
      recentConversations: [],
      recentDecisions: [],
      hasProfile: false,
      exportedAt: "",
    });
    expect(md).not.toContain("[[Profile]]");
    // Index links still present.
    expect(md).toContain("[[People]]");
  });
});

describe("buildEntityIndexNote", () => {
  it("lists entities sorted by day-count desc then name, with wikilinks + counts", () => {
    const md = buildEntityIndexNote({
      kind: "person",
      entries: [
        { name: "Anna", days: 1 },
        { name: "Yaofang", days: 9 },
        { name: "Taeyoon", days: 9 },
      ],
      exportedAt: "2026-07-20 10:00",
    });
    expect(md).toContain("# People");
    expect(md).toContain("count: 3");
    // Most-mentioned first; ties broken alphabetically (Taeyoon before Yaofang).
    const iTae = md.indexOf("[[Taeyoon]]");
    const iYao = md.indexOf("[[Yaofang]]");
    const iAnna = md.indexOf("[[Anna]]");
    expect(iTae).toBeGreaterThan(-1);
    expect(iTae).toBeLessThan(iYao);
    expect(iYao).toBeLessThan(iAnna);
    expect(md).toContain("[[Taeyoon]] — 9 days");
    expect(md).toContain("[[Anna]] — 1 day");
  });

  it("labels a conversation/reflection-only entity (0 days) distinctly", () => {
    const md = buildEntityIndexNote({
      kind: "person",
      entries: [{ name: "Chat Friend", days: 0 }],
      exportedAt: "",
    });
    expect(md).toContain("[[Chat Friend]] — from conversations");
    expect(md).not.toContain("0 days");
  });

  it("renders an empty index cleanly", () => {
    const md = buildEntityIndexNote({ kind: "place", entries: [], exportedAt: "" });
    expect(md).toContain("# Places");
    expect(md).toContain("_No places yet._");
  });
});

describe("buildProfileNote", () => {
  it("renders the profile content verbatim under a heading, linked to Home", () => {
    const profile = "# Kim Seongjin\n\nBuilder by nature. Goals: ship the wiki.";
    const md = buildProfileNote({
      profile,
      updatedAt: "2026-07-19 00:00:00",
      exportedAt: "2026-07-20 10:00",
    });
    expect(md).toContain("title: Profile");
    expect(md).toContain("type: profile");
    expect(md).toContain("[[Home]]");
    expect(md).toContain("Builder by nature. Goals: ship the wiki.");
  });
});
