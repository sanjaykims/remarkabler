import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/dropbox", () => ({
  readDropboxTextFiles: vi.fn(async () => ({
    files: [
      {
        folder: "/Apps/remotely-save/Diary/claude's lens",
        path: "/Apps/remotely-save/Diary/claude's lens/2026-09-11-0837KST-Claude's Lens — the flaw he found.md",
        name: "2026-09-11-0837KST-Claude's Lens — the flaw he found.md",
        modified: "2026-09-10T23:37:13Z",
        text: "He talked about Remarkabler and 태윤 on this day.",
      },
      {
        folder: "/Apps/remotely-save/Diary/Records",
        path: "/Apps/remotely-save/Diary/Records/plain.md",
        name: "plain.md",
        modified: "2026-10-01T00:00:00Z",
        text: "nothing relevant",
      },
    ],
  })),
}));
vi.mock("@/lib/insightSources", () => ({ insightDropboxFolders: () => ["/x"] }));

import { addVaultNotesToGraph } from "@/lib/vaultGraph";
import type { DiaryGraphPayload } from "@/lib/diaryGraph";

const base = (): DiaryGraphPayload => ({
  generatedAt: "t",
  nodes: [
    { id: "entity:project:remarkabler", type: "project", label: "Remarkabler", subtitle: "", size: 10, counts: { mentions: 1, diaryDays: 1, notes: 0, relationships: 0 } },
    { id: "entity:person:%ED%83%9C%EC%9C%A4", type: "person", label: "태윤", subtitle: "", size: 8, counts: { mentions: 1, diaryDays: 1, notes: 0, relationships: 0 } },
    { id: "day:2026-09-11", type: "day", label: "2026-09-11", subtitle: "", size: 5, counts: { mentions: 0, diaryDays: 1, notes: 0, relationships: 0 } },
  ],
  edges: [],
  stats: { entityCount: 2, dayCount: 1, contentCount: 0, relationshipCount: 0, mentionEdgeCount: 0, coOccurrenceEdgeCount: 0, totalEntityCount: 2, totalDayCount: 1, totalContentCount: 0, totalRelationshipCount: 0, topHubs: [] },
});

describe("addVaultNotesToGraph", () => {
  it("adds lens/record nodes linked to mentioned entities and the matching day", async () => {
    const g = await addVaultNotesToGraph(base());
    const lens = g.nodes.find((n) => n.type === "lens")!;
    expect(lens.label).toBe("the flaw he found");
    const targets = g.edges.filter((e) => e.source === lens.id).map((e) => e.target).sort();
    expect(targets).toEqual(["day:2026-09-11", "entity:person:%ED%83%9C%EC%9C%A4", "entity:project:remarkabler"].sort());
    const rec = g.nodes.find((n) => n.type === "record")!;
    expect(g.edges.some((e) => e.source === rec.id)).toBe(false);
    expect(g.stats.contentCount).toBe(2);
  });
});
