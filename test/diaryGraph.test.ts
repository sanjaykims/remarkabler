import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

type DbMod = typeof import("@/lib/db");
type GraphMod = typeof import("@/lib/diaryGraph");
type NotesMod = typeof import("@/lib/notes");
type CwMod = typeof import("@/lib/conversationWiki");
type CeMod = typeof import("@/lib/conversationEntities");
type RelMod = typeof import("@/lib/entityRelationships");
type MindMod = typeof import("@/lib/mind");
type DiaryGraphPayload = import("@/lib/diaryGraph").DiaryGraphPayload;

let dbMod: DbMod;
let graphMod: GraphMod;
let notesMod: NotesMod;
let cw: CwMod;
let ce: CeMod;
let rel: RelMod;
let mind: MindMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "diary-graph-"));
  process.env.ANTHROPIC_API_KEY = "test-key";
  dbMod = await import("@/lib/db");
  graphMod = await import("@/lib/diaryGraph");
  notesMod = await import("@/lib/notes");
  cw = await import("@/lib/conversationWiki");
  ce = await import("@/lib/conversationEntities");
  rel = await import("@/lib/entityRelationships");
  mind = await import("@/lib/mind");
  dbMod.db();
});

beforeEach(() => {
  const d = dbMod.db();
  d.prepare(`DELETE FROM entity_relationships`).run();
  d.prepare(`DELETE FROM entry_entities`).run();
  d.prepare(`DELETE FROM entry_analysis`).run();
  d.prepare(`DELETE FROM entity_aliases`).run();
  d.prepare(`DELETE FROM entity_conversation_notes`).run();
  d.prepare(`DELETE FROM mcp_conversations`).run();
  d.prepare(`DELETE FROM mcp_reflections`).run();
  d.prepare(`DELETE FROM mcp_decisions`).run();
  d.prepare(`DELETE FROM pages`).run();
  d.prepare(`DELETE FROM notebooks`).run();
});

function addNotebook(id: string, name: string, syncedAt = "2026-07-01 00:00:00") {
  dbMod
    .db()
    .prepare(`INSERT INTO notebooks(id, name, synced_at, status) VALUES(?,?,?,'done')`)
    .run(id, name, syncedAt);
}

function addPage(
  notebookId: string,
  index: number,
  text: string,
  entryDate: string | null
) {
  const id = `${notebookId}:${index}`;
  dbMod
    .db()
    .prepare(
      `INSERT INTO pages(id, notebook_id, page_index, ocr_text, entry_date)
       VALUES(?,?,?,?,?)`
    )
    .run(id, notebookId, index, text, entryDate);
  return id;
}

function addEntity(pageId: string, kind: "person" | "place" | "project", name: string) {
  dbMod
    .db()
    .prepare(
      `INSERT INTO entry_entities(page_id, kind, name, name_norm) VALUES(?,?,?,?)`
    )
    .run(pageId, kind, name, mind.normaliseEntityName(name));
}

function nodeByLabel(graph: DiaryGraphPayload, label: string) {
  return graph.nodes.find((node) => node.label === label);
}

describe("buildDiaryGraph", () => {
  it("connects diary days, exported conversation notes, and typed relationships", () => {
    addNotebook("nb1", "Diary");
    const p0 = addPage("nb1", 0, "Jin walked through Seoul", "2026-07-01");
    const p1 = addPage("nb1", 1, "The App came up again", "none");
    addEntity(p0, "person", "Jin");
    addEntity(p0, "place", "Seoul");
    addEntity(p1, "project", "App");
    addEntity(p1, "person", "jin");

    addNotebook(notesMod.DISCIPLINE_ID, "Discipline");
    const secret = addPage(notesMod.DISCIPLINE_ID, 0, "external repo notes", null);
    addEntity(secret, "person", "Secret Person");

    cw.saveExportedConversation({
      conversationId: "conv-graph",
      title: "Building the vault",
      content: "Jin is working on App in Seoul.",
    });
    expect(
      ce.tagConversationEntities({
        conversationKey: "conv-graph",
        entities: [
          { kind: "person", name: "Jin" },
          { kind: "project", name: "App" },
        ],
      })
    ).toMatchObject({ tagged: 2 });
    expect(
      rel.relateEntities({
        conversationKey: "conv-graph",
        relationships: [
          {
            subject_kind: "person",
            subject_name: "Jin",
            predicate: "works_at",
            object_kind: "project",
            object_name: "App",
          },
        ],
      })
    ).toMatchObject({ related: 1 });

    const graph = graphMod.buildDiaryGraph({
      entityLimit: 20,
      dayLimit: 20,
      contentLimit: 20,
      coOccurrenceLimit: 20,
    });
    const jin = nodeByLabel(graph, "Jin");
    const app = nodeByLabel(graph, "App");
    expect(jin).toMatchObject({ type: "person", counts: { diaryDays: 1 } });
    expect(app).toMatchObject({ type: "project" });
    expect(nodeByLabel(graph, "Seoul")).toMatchObject({ type: "place" });
    expect(nodeByLabel(graph, "2026-07-01")).toMatchObject({ type: "day" });
    expect(nodeByLabel(graph, "Building the vault")).toMatchObject({
      type: "conversation",
    });
    expect(nodeByLabel(graph, "Secret Person")).toBeUndefined();

    const relEdge = graph.edges.find(
      (edge) =>
        edge.type === "relationship" &&
        edge.label === "works at" &&
        edge.source === jin?.id &&
        edge.target === app?.id
    );
    expect(relEdge).toMatchObject({
      directed: true,
      evidenceCount: 1,
    });
    expect(relEdge?.evidence[0]).toMatchObject({
      kind: "conversation",
      label: "Building the vault",
    });

    expect(
      graph.edges.some(
        (edge) =>
          edge.type === "mentions" &&
          edge.source === "day:2026-07-01" &&
          edge.target === jin?.id
      )
    ).toBe(true);
    expect(
      graph.edges.some(
        (edge) =>
          edge.type === "co_occurs" &&
          ((edge.source === jin?.id && edge.target === app?.id) ||
            (edge.source === app?.id && edge.target === jin?.id))
      )
    ).toBe(true);
  });

  it("keeps relationship-only endpoints visible with their source conversation", () => {
    cw.saveExportedConversation({
      conversationId: "conv-only-rel",
      title: "One asserted edge",
      content: "Mina lives in Busan.",
    });
    expect(
      rel.relateEntities({
        conversationKey: "conv-only-rel",
        relationships: [
          {
            subject_kind: "person",
            subject_name: "Mina",
            predicate: "lives_in",
            object_kind: "place",
            object_name: "Busan",
          },
        ],
      })
    ).toMatchObject({ related: 1 });

    const graph = graphMod.buildDiaryGraph({
      entityLimit: 5,
      dayLimit: 5,
      contentLimit: 5,
      coOccurrenceLimit: 5,
    });
    const mina = nodeByLabel(graph, "Mina");
    const busan = nodeByLabel(graph, "Busan");
    const source = nodeByLabel(graph, "One asserted edge");
    expect(mina).toMatchObject({ type: "person" });
    expect(busan).toMatchObject({ type: "place" });
    expect(source).toMatchObject({ type: "conversation" });
    expect(
      graph.edges.some(
        (edge) =>
          edge.type === "relationship" &&
          edge.label === "lives in" &&
          edge.source === mina?.id &&
          edge.target === busan?.id
      )
    ).toBe(true);
    expect(
      graph.edges.some(
        (edge) =>
          edge.type === "mentions" &&
          edge.source === source?.id &&
          (edge.target === mina?.id || edge.target === busan?.id)
      )
    ).toBe(true);
  });
});
