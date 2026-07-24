import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";

type DbMod = typeof import("@/lib/db");
type CwMod = typeof import("@/lib/conversationWiki");
type RelMod = typeof import("@/lib/entityRelationships");
type MergeMod = typeof import("@/lib/entityMerge");

let dbMod: DbMod;
let cw: CwMod;
let rel: RelMod;
let merge: MergeMod;

beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "entity-rels-"));
  process.env.ANTHROPIC_API_KEY = "test-key";
  dbMod = await import("@/lib/db");
  cw = await import("@/lib/conversationWiki");
  rel = await import("@/lib/entityRelationships");
  merge = await import("@/lib/entityMerge");
  dbMod.db();
});

beforeEach(() => {
  const d = dbMod.db();
  d.prepare(`DELETE FROM entity_relationships`).run();
  d.prepare(`DELETE FROM entry_entities`).run();
  d.prepare(`DELETE FROM entity_aliases`).run();
  d.prepare(`DELETE FROM mcp_conversations`).run();
  d.prepare(`DELETE FROM pages`).run();
  d.prepare(`DELETE FROM notebooks`).run();
});

function conversation(key: string) {
  cw.saveExportedConversation({ content: `conversation ${key}`, conversationId: key });
}

function relationshipRows() {
  return dbMod
    .db()
    .prepare(
      `SELECT subject_kind, subject_norm, subject_name, predicate,
              object_kind, object_norm, object_name, source_key
       FROM entity_relationships
       ORDER BY source_key, predicate, subject_name, object_name`
    )
    .all() as Array<{
    subject_kind: string;
    subject_norm: string;
    subject_name: string;
    predicate: string;
    object_kind: string;
    object_norm: string;
    object_name: string;
    source_key: string;
  }>;
}

describe("relateEntities", () => {
  it("refuses an unknown conversation_key", () => {
    const result = rel.relateEntities({
      conversationKey: "missing",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Jin",
          predicate: "works_at",
          object_kind: "project",
          object_name: "Samsung",
        },
      ],
    });
    expect("error" in result).toBe(true);
  });

  it("scoped-replaces only one conversation's relationships", () => {
    conversation("c1");
    conversation("c2");
    rel.relateEntities({
      conversationKey: "c1",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Jin",
          predicate: "works_at",
          object_kind: "project",
          object_name: "Samsung",
        },
      ],
    });
    rel.relateEntities({
      conversationKey: "c2",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Mina",
          predicate: "lives_in",
          object_kind: "place",
          object_name: "Suwon",
        },
      ],
    });

    const rerun = rel.relateEntities({
      conversationKey: "c1",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Jin",
          predicate: "studied_at",
          object_kind: "project",
          object_name: "SNU",
        },
      ],
    });

    expect("error" in rerun).toBe(false);
    expect((rerun as { related: number }).related).toBe(1);
    expect(relationshipRows().map((r) => `${r.source_key}:${r.predicate}:${r.object_name}`)).toEqual([
      "c1:studied_at:SNU",
      "c2:lives_in:Suwon",
    ]);
  });

  it("empty set retracts that conversation's relationships and reports old endpoints as touched", () => {
    conversation("c1");
    rel.relateEntities({
      conversationKey: "c1",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Jin",
          predicate: "works_at",
          object_kind: "project",
          object_name: "Samsung",
        },
      ],
    });

    const result = rel.relateEntities({ conversationKey: "c1", relationships: [] });
    expect(result).toEqual({
      related: 0,
      endpoints: [
        { kind: "person", name: "Jin" },
        { kind: "project", name: "Samsung" },
      ],
    });
    expect(relationshipRows()).toEqual([]);
  });

  it("rejects invalid predicates, inherited object keys, and self-loops without mutating", () => {
    conversation("c1");
    rel.relateEntities({
      conversationKey: "c1",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Jin",
          predicate: "works_at",
          object_kind: "project",
          object_name: "Samsung",
        },
      ],
    });

    const invalidPredicate = rel.relateEntities({
      conversationKey: "c1",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Jin",
          predicate: "made_up",
          object_kind: "project",
          object_name: "Samsung",
        },
      ],
    });
    expect(invalidPredicate).toEqual({
      error:
        "relationships[0].predicate must be one of: friend_of, family_of, colleague_of, works_at, studied_at, lives_in, located_in, part_of, related_to.",
    });

    const inheritedKey = rel.relateEntities({
      conversationKey: "c1",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Jin",
          predicate: "toString",
          object_kind: "project",
          object_name: "Samsung",
        },
      ],
    });
    expect("error" in inheritedKey).toBe(true);

    const selfLoop = rel.relateEntities({
      conversationKey: "c1",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Jin",
          predicate: "friend_of",
          object_kind: "person",
          object_name: "JIN",
        },
      ],
    });
    expect(selfLoop).toEqual({
      error: "relationships[0] resolves to the same person entity on both sides.",
    });
    expect(relationshipRows().map((r) => `${r.source_key}:${r.predicate}:${r.object_name}`)).toEqual([
      "c1:works_at:Samsung",
    ]);
  });

  it("rejects over-large replacement payloads without mutating", () => {
    conversation("c1");
    rel.relateEntities({
      conversationKey: "c1",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Jin",
          predicate: "works_at",
          object_kind: "project",
          object_name: "Samsung",
        },
      ],
    });

    const many = Array.from({ length: 41 }, (_, i) => ({
      subject_kind: "person",
      subject_name: `Person ${i}`,
      predicate: "related_to",
      object_kind: "project",
      object_name: `Project ${i}`,
    }));
    expect(rel.relateEntities({ conversationKey: "c1", relationships: many })).toEqual({
      error: "relate_entities accepts at most 40 relationships per call.",
    });
    expect(relationshipRows().map((r) => `${r.source_key}:${r.predicate}:${r.object_name}`)).toEqual([
      "c1:works_at:Samsung",
    ]);
  });

  it("folds endpoints through aliases and existing canonical casing", () => {
    conversation("c1");
    dbMod
      .db()
      .prepare(
        `INSERT INTO entity_aliases(kind, alias_norm, alias_name, canonical_norm, canonical_name)
         VALUES('person', 'jinny', 'Jinny', 'jin', 'Jin')`
      )
      .run();
    dbMod
      .db()
      .prepare(
        `INSERT INTO notebooks(id, name, synced_at) VALUES('nb1', 'Diary', datetime('now'))`
      )
      .run();
    dbMod
      .db()
      .prepare(
        `INSERT INTO pages(id, notebook_id, page_index, ocr_text) VALUES('p1', 'nb1', 0, 'Samsung mention')`
      )
      .run();
    dbMod
      .db()
      .prepare(
        `INSERT INTO entry_entities(page_id, kind, name, name_norm)
         VALUES('p1', 'project', 'Samsung', 'samsung')`
      )
      .run();

    rel.relateEntities({
      conversationKey: "c1",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Jinny",
          predicate: "works_at",
          object_kind: "project",
          object_name: "samsung",
        },
      ],
    });

    expect(relationshipRows()[0]).toMatchObject({
      subject_norm: "jin",
      subject_name: "Jin",
      object_norm: "samsung",
      object_name: "Samsung",
    });
  });

  it("reads both directions and dedupes the same logical edge across sources", () => {
    conversation("c1");
    conversation("c2");
    rel.relateEntities({
      conversationKey: "c1",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Jin",
          predicate: "works_at",
          object_kind: "project",
          object_name: "Samsung",
        },
      ],
    });
    rel.relateEntities({
      conversationKey: "c2",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "jin",
          predicate: "works_at",
          object_kind: "project",
          object_name: "samsung",
        },
      ],
    });

    expect(rel.getRelationshipsFor("person", "jin")).toEqual([
      {
        predicate: "works_at",
        otherKind: "project",
        otherName: "Samsung",
        direction: "out",
      },
    ]);
    expect(rel.getRelationshipsFor("project", "samsung")).toEqual([
      {
        predicate: "works_at",
        otherKind: "person",
        otherName: "Jin",
        direction: "in",
      },
    ]);
  });
});

describe("mergeEntity relationship endpoint rewrite", () => {
  it("rewrites alias endpoints and drops collisions/self-loops", () => {
    conversation("c1");
    conversation("c2");
    rel.relateEntities({
      conversationKey: "c1",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Jinny",
          predicate: "friend_of",
          object_kind: "person",
          object_name: "Jin",
        },
      ],
    });
    rel.relateEntities({
      conversationKey: "c2",
      relationships: [
        {
          subject_kind: "person",
          subject_name: "Mina",
          predicate: "friend_of",
          object_kind: "person",
          object_name: "Jinny",
        },
      ],
    });

    merge.mergeEntity("person", "jinny", "Jinny", "jin", "Jin");
    const rows = relationshipRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      subject_name: "Mina",
      predicate: "friend_of",
      object_norm: "jin",
      object_name: "Jin",
    });
  });
});
