import { db, setSetting } from "./db";
import { resolveConversationEntityName } from "./conversationEntities";
import { getConversationByKey } from "./conversationWiki";
import { isEntityPredicate, PREDICATES } from "./entityPredicates";

export type EntityKind = "person" | "place" | "project";
export type RelationshipDirection = "out" | "in";

export { PREDICATES };

const KINDS = new Set(["person", "place", "project"]);
const SOURCE_KIND = "librarian_conversation";
const MAX_RELATIONSHIPS_PER_CALL = 40;
const MAX_NAME_CHARS = 200;

export type RelationshipInput = {
  subject_kind: string;
  subject_name: string;
  predicate: string;
  object_kind: string;
  object_name: string;
};

type CleanRelationshipInput = {
  inputIndex: number;
  subjectKind: EntityKind;
  subjectName: string;
  predicate: string;
  objectKind: EntityKind;
  objectName: string;
};

type ResolvedRelationshipInput = CleanRelationshipInput & {
  subjectNorm: string;
  resolvedSubjectName: string;
  objectNorm: string;
  resolvedObjectName: string;
};

export type RelationshipEndpoint = {
  kind: EntityKind;
  name: string;
};

export type RelationshipWriteResult = {
  related: number;
  endpoints: RelationshipEndpoint[];
};

export type RelationshipForEntity = {
  predicate: string;
  otherKind: EntityKind;
  otherName: string;
  direction: RelationshipDirection;
};

export type RelationshipRow = {
  subject_kind: EntityKind;
  subject_norm: string;
  subject_name: string;
  predicate: string;
  object_kind: EntityKind;
  object_norm: string;
  object_name: string;
};

function isEntityKind(value: string): value is EntityKind {
  return KINDS.has(value);
}

function cleanRelationships(
  input: RelationshipInput[]
): { clean: CleanRelationshipInput[] } | { error: string } {
  if (input.length > MAX_RELATIONSHIPS_PER_CALL) {
    return {
      error: `relate_entities accepts at most ${MAX_RELATIONSHIPS_PER_CALL} relationships per call.`,
    };
  }
  const clean: CleanRelationshipInput[] = [];
  for (const [i, r] of input.entries()) {
    const subjectKind = String(r?.subject_kind || "").trim().toLowerCase();
    const subjectName = String(r?.subject_name || "").trim().slice(0, MAX_NAME_CHARS);
    const predicate = String(r?.predicate || "").trim().toLowerCase();
    const objectKind = String(r?.object_kind || "").trim().toLowerCase();
    const objectName = String(r?.object_name || "").trim().slice(0, MAX_NAME_CHARS);
    if (!isEntityKind(subjectKind)) {
      return {
        error: `relationships[${i}].subject_kind must be one of: person, place, project.`,
      };
    }
    if (!subjectName) {
      return { error: `relationships[${i}].subject_name is required.` };
    }
    if (!isEntityPredicate(predicate)) {
      return {
        error: `relationships[${i}].predicate must be one of: ${Object.keys(PREDICATES).join(
          ", "
        )}.`,
      };
    }
    if (!isEntityKind(objectKind)) {
      return {
        error: `relationships[${i}].object_kind must be one of: person, place, project.`,
      };
    }
    if (!objectName) {
      return { error: `relationships[${i}].object_name is required.` };
    }
    clean.push({
      inputIndex: i,
      subjectKind,
      subjectName,
      predicate,
      objectKind,
      objectName,
    });
  }
  return { clean };
}

export function relateEntities(input: {
  conversationKey: string;
  relationships: RelationshipInput[];
}): RelationshipWriteResult | { error: string } {
  if (!getConversationByKey(input.conversationKey)) {
    return {
      error: `Unknown conversation_key "${input.conversationKey}" — export it first with export_conversation.`,
    };
  }

  const cleaned = cleanRelationships(input.relationships || []);
  if ("error" in cleaned) return { error: cleaned.error };
  const resolved: ResolvedRelationshipInput[] = [];
  for (const r of cleaned.clean) {
    const subject = resolveConversationEntityName(r.subjectKind, r.subjectName);
    const object = resolveConversationEntityName(r.objectKind, r.objectName);
    if (r.subjectKind === r.objectKind && subject.norm === object.norm) {
      return {
        error: `relationships[${r.inputIndex}] resolves to the same ${r.subjectKind} entity on both sides.`,
      };
    }
    resolved.push({
      ...r,
      subjectNorm: subject.norm,
      resolvedSubjectName: subject.name,
      objectNorm: object.norm,
      resolvedObjectName: object.name,
    });
  }
  const existing = db()
    .prepare(
      `SELECT subject_kind, subject_norm, subject_name, object_kind, object_norm, object_name
       FROM entity_relationships
       WHERE source_kind = ? AND source_key = ?`
    )
    .all(SOURCE_KIND, input.conversationKey) as Array<{
    subject_kind: EntityKind;
    subject_norm: string;
    subject_name: string;
    object_kind: EntityKind;
    object_norm: string;
    object_name: string;
  }>;
  const del = db().prepare(
    `DELETE FROM entity_relationships WHERE source_kind = ? AND source_key = ?`
  );
  const ins = db().prepare(
    `INSERT OR IGNORE INTO entity_relationships
       (subject_kind, subject_norm, subject_name, predicate,
        object_kind, object_norm, object_name, source_kind, source_key, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );

  let related = 0;
  const endpoints = new Map<string, RelationshipEndpoint>();
  for (const r of existing) {
    endpoints.set(`${r.subject_kind}\0${r.subject_norm}`, {
      kind: r.subject_kind,
      name: r.subject_name,
    });
    endpoints.set(`${r.object_kind}\0${r.object_norm}`, {
      kind: r.object_kind,
      name: r.object_name,
    });
  }
  db().transaction(() => {
    del.run(SOURCE_KIND, input.conversationKey);
    for (const r of resolved) {
      const res = ins.run(
        r.subjectKind,
        r.subjectNorm,
        r.resolvedSubjectName,
        r.predicate,
        r.objectKind,
        r.objectNorm,
        r.resolvedObjectName,
        SOURCE_KIND,
        input.conversationKey
      );
      if (res.changes > 0) related++;
      endpoints.set(`${r.subjectKind}\0${r.subjectNorm}`, {
        kind: r.subjectKind,
        name: r.resolvedSubjectName,
      });
      endpoints.set(`${r.objectKind}\0${r.objectNorm}`, {
        kind: r.objectKind,
        name: r.resolvedObjectName,
      });
    }
  })();

  setSetting("librarian_last_write_at", new Date().toISOString());
  return { related, endpoints: [...endpoints.values()] };
}

export function getRelationshipsFor(
  kind: string,
  norm: string
): RelationshipForEntity[] {
  try {
    const outRows = db()
      .prepare(
        `SELECT predicate, object_kind AS otherKind, object_norm AS otherNorm,
                MIN(object_name) AS otherName
         FROM entity_relationships
         WHERE subject_kind = ? AND subject_norm = ?
         GROUP BY predicate, object_kind, object_norm
         ORDER BY predicate, object_kind, object_name`
      )
      .all(kind, norm) as Array<{
      predicate: string;
      otherKind: EntityKind;
      otherNorm: string;
      otherName: string;
    }>;
    const inRows = db()
      .prepare(
        `SELECT predicate, subject_kind AS otherKind, subject_norm AS otherNorm,
                MIN(subject_name) AS otherName
         FROM entity_relationships
         WHERE object_kind = ? AND object_norm = ?
         GROUP BY predicate, subject_kind, subject_norm
         ORDER BY predicate, subject_kind, subject_name`
      )
      .all(kind, norm) as Array<{
      predicate: string;
      otherKind: EntityKind;
      otherNorm: string;
      otherName: string;
    }>;

    const seen = new Set<string>();
    const relationships: RelationshipForEntity[] = [];
    for (const [direction, rows] of [
      ["out", outRows],
      ["in", inRows],
    ] as const) {
      for (const r of rows) {
        const key = `${direction}\0${r.predicate}\0${r.otherKind}\0${r.otherNorm}`;
        if (seen.has(key)) continue;
        seen.add(key);
        relationships.push({
          predicate: r.predicate,
          otherKind: r.otherKind,
          otherName: r.otherName,
          direction,
        });
      }
    }
    return relationships;
  } catch {
    return [];
  }
}

export function allRelationshipRows(): RelationshipRow[] {
  try {
    return db()
      .prepare(
        `SELECT subject_kind, subject_norm, MIN(subject_name) AS subject_name,
                predicate, object_kind, object_norm, MIN(object_name) AS object_name
         FROM entity_relationships
         GROUP BY subject_kind, subject_norm, predicate, object_kind, object_norm
         ORDER BY subject_kind, subject_name, predicate, object_kind, object_name`
      )
      .all() as RelationshipRow[];
  } catch {
    return [];
  }
}
