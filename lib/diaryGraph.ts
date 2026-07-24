import { db } from "./db";
import {
  carryForwardDates,
  entityStubFileName,
  type DiaryPageRow,
} from "./diaryExport";
import { PREDICATES } from "./entityPredicates";
import {
  CONVERSATIONS_NOTEBOOK_ID,
  DECISIONS_NOTEBOOK_ID,
  DISCIPLINE_ID,
  REFLECTIONS_NOTEBOOK_ID,
} from "./notes";
import {
  conversationNoteFileName,
  type ExportedConversationRow,
} from "./conversationWiki";
import {
  reflectionNoteFileName,
  type SavedReflectionRow,
} from "./reflectionWiki";
import { decisionNoteFileName, type SavedDecisionRow } from "./decisionWiki";

export type EntityKind = "person" | "place" | "project";
export type ContentKind = "conversation" | "reflection" | "decision";
export type DiaryGraphNodeType = EntityKind | "day" | ContentKind;
export type DiaryGraphEdgeType = "mentions" | "co_occurs" | "relationship";

export type DiaryGraphEvidence = {
  kind: "diary" | ContentKind | "relationship";
  label: string;
  date?: string | null;
  pageId?: string;
  sourceKey?: string;
  vaultPath?: string;
  preview?: string;
};

export type DiaryGraphNode = {
  id: string;
  type: DiaryGraphNodeType;
  label: string;
  subtitle: string;
  size: number;
  date?: string | null;
  kind?: EntityKind;
  norm?: string;
  vaultPath?: string;
  counts: {
    mentions: number;
    diaryDays: number;
    notes: number;
    relationships: number;
  };
};

export type DiaryGraphEdge = {
  id: string;
  source: string;
  target: string;
  type: DiaryGraphEdgeType;
  label: string;
  weight: number;
  directed: boolean;
  predicate?: string;
  evidenceCount: number;
  evidence: DiaryGraphEvidence[];
};

export type DiaryGraphPayload = {
  generatedAt: string;
  nodes: DiaryGraphNode[];
  edges: DiaryGraphEdge[];
  stats: {
    entityCount: number;
    dayCount: number;
    contentCount: number;
    relationshipCount: number;
    mentionEdgeCount: number;
    coOccurrenceEdgeCount: number;
    totalEntityCount: number;
    totalDayCount: number;
    totalContentCount: number;
    totalRelationshipCount: number;
    topHubs: Array<{
      id: string;
      label: string;
      type: DiaryGraphNodeType;
      score: number;
    }>;
  };
};

export type DiaryGraphOptions = {
  entityLimit?: number;
  dayLimit?: number;
  contentLimit?: number;
  coOccurrenceLimit?: number;
  evidenceLimit?: number;
};

type DiaryDbRow = DiaryPageRow & {
  synced_at: string | null;
  summary: string | null;
};

type EntityStats = {
  id: string;
  kind: EntityKind;
  norm: string;
  name: string;
  diaryPages: Set<string>;
  diaryDays: Set<string>;
  contentNotes: Set<string>;
  relationships: number;
};

type DayStats = {
  id: string;
  date: string;
  pages: Set<string>;
  entities: Set<string>;
  evidenceByEntity: Map<string, DiaryGraphEvidence[]>;
};

type ContentInfo = {
  id: string;
  type: ContentKind;
  key: string;
  pageId: string;
  label: string;
  date: string | null;
  vaultPath: string;
  sourceKind: string;
};

type ContentStats = ContentInfo & {
  entities: Set<string>;
  evidenceByEntity: Map<string, DiaryGraphEvidence[]>;
};

type RelationshipRow = {
  subject_kind: EntityKind;
  subject_norm: string;
  subject_name: string;
  predicate: string;
  object_kind: EntityKind;
  object_norm: string;
  object_name: string;
  source_kind: string;
  source_key: string;
  updated_at: string;
};

const DEFAULTS = {
  entityLimit: 120,
  dayLimit: 72,
  contentLimit: 72,
  coOccurrenceLimit: 180,
  evidenceLimit: 6,
};

const SYNTHETIC_NOTEBOOK_IDS = new Set([
  CONVERSATIONS_NOTEBOOK_ID,
  REFLECTIONS_NOTEBOOK_ID,
  DECISIONS_NOTEBOOK_ID,
]);

const ENTITY_KINDS = new Set(["person", "place", "project"]);

function isEntityKind(kind: string): kind is EntityKind {
  return ENTITY_KINDS.has(kind);
}

function sanitizeEntityName(name: string): string {
  return name
    .replace(/[[\]|]/g, "")
    .replace(/[/\\:*?"<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dateKey(value: string | null | undefined): string | null {
  const m = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function entityId(kind: EntityKind, norm: string): string {
  return `entity:${kind}:${encodeURIComponent(norm)}`;
}

function dayId(date: string): string {
  return `day:${date}`;
}

function contentId(type: ContentKind, key: string): string {
  return `note:${type}:${encodeURIComponent(key)}`;
}

function titleOrFallback(title: string | null, fallback: string): string {
  const trimmed = (title || "").trim();
  return trimmed || fallback;
}

function preview(text: string | null | undefined): string | undefined {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return undefined;
  return clean.length > 180 ? `${clean.slice(0, 177)}...` : clean;
}

function evidenceKey(e: DiaryGraphEvidence): string {
  return `${e.kind}\0${e.sourceKey || ""}\0${e.pageId || ""}\0${e.date || ""}\0${e.label}`;
}

function relationshipLabel(predicate: string): string {
  return PREDICATES[predicate] || predicate.replace(/_/g, " ");
}

function canonicalKey(kind: string, norm: string): string {
  return `${kind}\0${norm}`;
}

function fetchCanonicalEntityNames(): Map<string, string> {
  const rows = db()
    .prepare(
      `SELECT e.kind, e.name_norm, MIN(e.name) AS canonical_name
         FROM entry_entities e
         JOIN pages p ON p.id = e.page_id
        WHERE p.notebook_id != ?
        GROUP BY e.kind, e.name_norm`
    )
    .all(DISCIPLINE_ID) as Array<{
    kind: string;
    name_norm: string;
    canonical_name: string;
  }>;
  const out = new Map<string, string>();
  for (const r of rows) {
    out.set(canonicalKey(r.kind, r.name_norm), sanitizeEntityName(r.canonical_name));
  }
  return out;
}

function fetchDiaryRows(): DiaryDbRow[] {
  return db()
    .prepare(
      `SELECT p.id, p.notebook_id, p.entry_date, p.page_index, p.ocr_text,
              n.name AS notebook_name,
              n.synced_at,
              a.themes,
              a.sentiment,
              a.summary
         FROM pages p
         JOIN notebooks n ON n.id = p.notebook_id
         LEFT JOIN entry_analysis a ON a.page_id = p.id
        WHERE p.ocr_text IS NOT NULL
          AND p.ocr_text != ''
          AND p.notebook_id NOT IN (?, ?, ?, ?)
        ORDER BY
          n.synced_at ASC NULLS LAST,
          p.notebook_id ASC,
          p.page_index ASC`
    )
    .all(
      DISCIPLINE_ID,
      CONVERSATIONS_NOTEBOOK_ID,
      REFLECTIONS_NOTEBOOK_ID,
      DECISIONS_NOTEBOOK_ID
    ) as DiaryDbRow[];
}

function fetchEntityMentions(): Array<{
  page_id: string;
  notebook_id: string;
  kind: EntityKind;
  name: string;
  name_norm: string;
}> {
  return db()
    .prepare(
      `SELECT e.page_id,
              p.notebook_id,
              e.kind,
              e.name,
              e.name_norm
         FROM entry_entities e
         JOIN pages p ON p.id = e.page_id
        WHERE p.notebook_id != ?
        ORDER BY p.notebook_id, p.page_index, e.kind, e.name_norm`
    )
    .all(DISCIPLINE_ID) as Array<{
    page_id: string;
    notebook_id: string;
    kind: EntityKind;
    name: string;
    name_norm: string;
  }>;
}

function fetchRelationships(): RelationshipRow[] {
  try {
    return db()
      .prepare(
        `SELECT subject_kind, subject_norm, subject_name,
                predicate,
                object_kind, object_norm, object_name,
                source_kind, source_key, updated_at
           FROM entity_relationships
          ORDER BY updated_at DESC, source_kind, source_key`
      )
      .all() as RelationshipRow[];
  } catch {
    return [];
  }
}

function fetchContentInfo(): {
  byPageId: Map<string, ContentInfo>;
  bySource: Map<string, ContentInfo>;
} {
  const byPageId = new Map<string, ContentInfo>();
  const bySource = new Map<string, ContentInfo>();

  const add = (info: ContentInfo) => {
    byPageId.set(info.pageId, info);
    bySource.set(`${info.sourceKind}\0${info.key}`, info);
  };

  const conversations = db()
    .prepare(
      `SELECT conversation_key, title, content, created_at
         FROM mcp_conversations
        ORDER BY created_at ASC`
    )
    .all() as ExportedConversationRow[];
  for (const row of conversations) {
    const key = row.conversation_key;
    add({
      id: contentId("conversation", key),
      type: "conversation",
      key,
      pageId: `${CONVERSATIONS_NOTEBOOK_ID}:${key}`,
      label: titleOrFallback(row.title, `Conversation ${dateKey(row.created_at) || "undated"}`),
      date: dateKey(row.created_at),
      vaultPath: conversationNoteFileName(row),
      sourceKind: "librarian_conversation",
    });
  }

  const reflections = db()
    .prepare(
      `SELECT reflection_key, title, content, created_at
         FROM mcp_reflections
        ORDER BY created_at ASC`
    )
    .all() as SavedReflectionRow[];
  for (const row of reflections) {
    const key = row.reflection_key;
    add({
      id: contentId("reflection", key),
      type: "reflection",
      key,
      pageId: `${REFLECTIONS_NOTEBOOK_ID}:${key}`,
      label: titleOrFallback(row.title, `Reflection ${dateKey(row.created_at) || "undated"}`),
      date: dateKey(row.created_at),
      vaultPath: reflectionNoteFileName(row),
      sourceKind: "librarian_reflection",
    });
  }

  const decisions = db()
    .prepare(
      `SELECT decision_key, title, content, created_at
         FROM mcp_decisions
        ORDER BY created_at ASC`
    )
    .all() as SavedDecisionRow[];
  for (const row of decisions) {
    const key = row.decision_key;
    add({
      id: contentId("decision", key),
      type: "decision",
      key,
      pageId: `${DECISIONS_NOTEBOOK_ID}:${key}`,
      label: titleOrFallback(row.title, `Decision ${dateKey(row.created_at) || "undated"}`),
      date: dateKey(row.created_at),
      vaultPath: decisionNoteFileName(row),
      sourceKind: "librarian_decision",
    });
  }

  return { byPageId, bySource };
}

function ensureEntity(
  entities: Map<string, EntityStats>,
  canonicalNames: Map<string, string>,
  kind: EntityKind,
  norm: string,
  rawName: string
): EntityStats {
  const id = entityId(kind, norm);
  let entity = entities.get(id);
  if (!entity) {
    entity = {
      id,
      kind,
      norm,
      name: canonicalNames.get(canonicalKey(kind, norm)) || sanitizeEntityName(rawName) || norm,
      diaryPages: new Set(),
      diaryDays: new Set(),
      contentNotes: new Set(),
      relationships: 0,
    };
    entities.set(id, entity);
  }
  return entity;
}

function addEvidence(
  list: DiaryGraphEvidence[],
  evidence: DiaryGraphEvidence,
  limit: number
): void {
  const key = evidenceKey(evidence);
  if (list.some((item) => evidenceKey(item) === key)) return;
  if (list.length < limit) list.push(evidence);
}

function addEdge(
  edges: Map<string, DiaryGraphEdge>,
  edge: Omit<DiaryGraphEdge, "evidence" | "evidenceCount">,
  evidence: DiaryGraphEvidence,
  evidenceLimit: number
): void {
  const existing = edges.get(edge.id);
  if (!existing) {
    edges.set(edge.id, {
      ...edge,
      evidenceCount: 1,
      evidence: [evidence],
    });
    return;
  }
  existing.weight += edge.weight;
  existing.evidenceCount += 1;
  addEvidence(existing.evidence, evidence, evidenceLimit);
}

function entityScore(e: EntityStats): number {
  return (
    e.diaryDays.size * 6 +
    e.contentNotes.size * 5 +
    e.relationships * 8 +
    e.diaryPages.size
  );
}

function sortByDateDesc(a: string | null | undefined, b: string | null | undefined): number {
  return String(b || "").localeCompare(String(a || ""));
}

function nodeSize(score: number, min = 7, max = 22): number {
  return Math.round(Math.max(min, Math.min(max, min + Math.sqrt(score) * 3)));
}

export function buildDiaryGraph(options: DiaryGraphOptions = {}): DiaryGraphPayload {
  const opts = { ...DEFAULTS, ...options };
  const canonicalNames = fetchCanonicalEntityNames();
  const diaryRows = fetchDiaryRows();
  const enrichedDiaryRows = carryForwardDates(diaryRows);
  const pageInfo = new Map<
    string,
    { row: DiaryDbRow; effectiveDate: string | null }
  >();
  for (const item of enrichedDiaryRows) {
    pageInfo.set(item.row.id, {
      row: item.row as DiaryDbRow,
      effectiveDate: item.effectiveDate,
    });
  }

  const contentInfo = fetchContentInfo();
  const relationships = fetchRelationships();
  const entities = new Map<string, EntityStats>();
  const days = new Map<string, DayStats>();
  const contents = new Map<string, ContentStats>();
  const relationshipEndpointIds = new Set<string>();
  const relationshipSourceContentIds = new Set<string>();

  const ensureDay = (date: string): DayStats => {
    const id = dayId(date);
    let day = days.get(id);
    if (!day) {
      day = {
        id,
        date,
        pages: new Set(),
        entities: new Set(),
        evidenceByEntity: new Map(),
      };
      days.set(id, day);
    }
    return day;
  };

  const ensureContent = (info: ContentInfo): ContentStats => {
    let content = contents.get(info.id);
    if (!content) {
      content = {
        ...info,
        entities: new Set(),
        evidenceByEntity: new Map(),
      };
      contents.set(info.id, content);
    }
    return content;
  };

  for (const rel of relationships) {
    if (!isEntityKind(rel.subject_kind) || !isEntityKind(rel.object_kind)) continue;
    const subject = ensureEntity(
      entities,
      canonicalNames,
      rel.subject_kind,
      rel.subject_norm,
      rel.subject_name
    );
    const object = ensureEntity(
      entities,
      canonicalNames,
      rel.object_kind,
      rel.object_norm,
      rel.object_name
    );
    subject.relationships += 1;
    object.relationships += 1;
    relationshipEndpointIds.add(subject.id);
    relationshipEndpointIds.add(object.id);
    const sourceContent = contentInfo.bySource.get(`${rel.source_kind}\0${rel.source_key}`);
    if (sourceContent) {
      relationshipSourceContentIds.add(sourceContent.id);
      const content = ensureContent(sourceContent);
      content.entities.add(subject.id);
      content.entities.add(object.id);
      subject.contentNotes.add(content.id);
      object.contentNotes.add(content.id);
      for (const entity of [subject, object]) {
        const evidenceList = content.evidenceByEntity.get(entity.id) || [];
        addEvidence(
          evidenceList,
          {
            kind: sourceContent.type,
            sourceKey: sourceContent.key,
            date: sourceContent.date,
            vaultPath: sourceContent.vaultPath,
            label: sourceContent.label,
          },
          opts.evidenceLimit
        );
        content.evidenceByEntity.set(entity.id, evidenceList);
      }
    }
  }

  for (const mention of fetchEntityMentions()) {
    if (!isEntityKind(mention.kind)) continue;
    const entity = ensureEntity(
      entities,
      canonicalNames,
      mention.kind,
      mention.name_norm,
      mention.name
    );

    if (!SYNTHETIC_NOTEBOOK_IDS.has(mention.notebook_id)) {
      const info = pageInfo.get(mention.page_id);
      if (!info || !info.effectiveDate) continue;
      const day = ensureDay(info.effectiveDate);
      day.pages.add(mention.page_id);
      day.entities.add(entity.id);
      entity.diaryPages.add(mention.page_id);
      entity.diaryDays.add(info.effectiveDate);
      const evidenceList = day.evidenceByEntity.get(entity.id) || [];
      addEvidence(
        evidenceList,
        {
          kind: "diary",
          pageId: mention.page_id,
          date: info.effectiveDate,
          vaultPath: `${info.effectiveDate}.md`,
          label: `${info.effectiveDate} - ${info.row.notebook_name} p.${info.row.page_index + 1}`,
          preview: preview(info.row.summary || info.row.ocr_text),
        },
        opts.evidenceLimit
      );
      day.evidenceByEntity.set(entity.id, evidenceList);
      continue;
    }

    const contentBase = contentInfo.byPageId.get(mention.page_id);
    if (!contentBase) continue;
    const content = ensureContent(contentBase);
    content.entities.add(entity.id);
    entity.contentNotes.add(content.id);
    const evidenceList = content.evidenceByEntity.get(entity.id) || [];
    addEvidence(
      evidenceList,
      {
        kind: content.type,
        sourceKey: content.key,
        date: content.date,
        vaultPath: content.vaultPath,
        label: content.label,
      },
      opts.evidenceLimit
    );
    content.evidenceByEntity.set(entity.id, evidenceList);
  }

  const selectedEntityIds = new Set<string>();
  for (const id of relationshipEndpointIds) selectedEntityIds.add(id);
  const rankedEntities = [...entities.values()].sort(
    (a, b) => entityScore(b) - entityScore(a) || a.name.localeCompare(b.name)
  );
  for (const entity of rankedEntities) {
    if (selectedEntityIds.size >= opts.entityLimit && !relationshipEndpointIds.has(entity.id)) {
      continue;
    }
    selectedEntityIds.add(entity.id);
  }

  const selectedDays = [...days.values()]
    .map((day) => {
      let selectedEntities = 0;
      for (const id of day.entities) if (selectedEntityIds.has(id)) selectedEntities++;
      return { day, selectedEntities };
    })
    .filter((item) => item.selectedEntities > 0)
    .sort(
      (a, b) =>
        b.selectedEntities - a.selectedEntities ||
        b.day.pages.size - a.day.pages.size ||
        sortByDateDesc(a.day.date, b.day.date)
    )
    .slice(0, opts.dayLimit)
    .map((item) => item.day);

  const selectedContents = [...contents.values()]
    .map((content) => {
      let selectedEntities = 0;
      for (const id of content.entities) if (selectedEntityIds.has(id)) selectedEntities++;
      const pinned = relationshipSourceContentIds.has(content.id);
      return { content, selectedEntities, pinned };
    })
    .filter((item) => item.selectedEntities > 0 || item.pinned)
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.selectedEntities - a.selectedEntities ||
        sortByDateDesc(a.content.date, b.content.date) ||
        a.content.label.localeCompare(b.content.label)
    );
  const selectedContentIds = new Set<string>();
  for (const item of selectedContents) {
    if (selectedContentIds.size >= opts.contentLimit && !item.pinned) continue;
    selectedContentIds.add(item.content.id);
  }

  const nodes: DiaryGraphNode[] = [];
  for (const entity of rankedEntities) {
    if (!selectedEntityIds.has(entity.id)) continue;
    nodes.push({
      id: entity.id,
      type: entity.kind,
      kind: entity.kind,
      norm: entity.norm,
      label: entity.name,
      subtitle: [
        entity.kind,
        entity.diaryDays.size ? `${entity.diaryDays.size} day${entity.diaryDays.size === 1 ? "" : "s"}` : "",
        entity.contentNotes.size ? `${entity.contentNotes.size} note${entity.contentNotes.size === 1 ? "" : "s"}` : "",
        entity.relationships ? `${entity.relationships} relationship${entity.relationships === 1 ? "" : "s"}` : "",
      ]
        .filter(Boolean)
        .join(" - "),
      size: nodeSize(entityScore(entity)),
      vaultPath: entityStubFileName(entity.kind, entity.name),
      counts: {
        mentions: entity.diaryPages.size + entity.contentNotes.size,
        diaryDays: entity.diaryDays.size,
        notes: entity.contentNotes.size,
        relationships: entity.relationships,
      },
    });
  }

  for (const day of selectedDays) {
    nodes.push({
      id: day.id,
      type: "day",
      label: day.date,
      subtitle: `${day.pages.size} page${day.pages.size === 1 ? "" : "s"}`,
      size: nodeSize(day.pages.size + day.entities.size, 8, 18),
      date: day.date,
      vaultPath: `${day.date}.md`,
      counts: {
        mentions: day.entities.size,
        diaryDays: 1,
        notes: 0,
        relationships: 0,
      },
    });
  }

  for (const content of selectedContents.map((item) => item.content)) {
    if (!selectedContentIds.has(content.id)) continue;
    nodes.push({
      id: content.id,
      type: content.type,
      label: content.label,
      subtitle: [content.type, content.date].filter(Boolean).join(" - "),
      size: nodeSize(content.entities.size + 2, 8, 18),
      date: content.date,
      vaultPath: content.vaultPath,
      counts: {
        mentions: content.entities.size,
        diaryDays: 0,
        notes: 1,
        relationships: 0,
      },
    });
  }

  const edges = new Map<string, DiaryGraphEdge>();

  for (const day of selectedDays) {
    for (const entityIdValue of day.entities) {
      if (!selectedEntityIds.has(entityIdValue)) continue;
      const evidenceList = day.evidenceByEntity.get(entityIdValue) || [];
      for (const ev of evidenceList) {
        addEdge(
          edges,
          {
            id: `mention:${day.id}:${entityIdValue}`,
            source: day.id,
            target: entityIdValue,
            type: "mentions",
            label: "mentioned",
            weight: 1,
            directed: false,
          },
          ev,
          opts.evidenceLimit
        );
      }
    }
  }

  for (const content of selectedContents.map((item) => item.content)) {
    if (!selectedContentIds.has(content.id)) continue;
    for (const entityIdValue of content.entities) {
      if (!selectedEntityIds.has(entityIdValue)) continue;
      const evidenceList = content.evidenceByEntity.get(entityIdValue) || [];
      for (const ev of evidenceList) {
        addEdge(
          edges,
          {
            id: `mention:${content.id}:${entityIdValue}`,
            source: content.id,
            target: entityIdValue,
            type: "mentions",
            label: "linked",
            weight: 1,
            directed: false,
          },
          ev,
          opts.evidenceLimit
        );
      }
    }
  }

  const coOccurrences = new Map<
    string,
    { source: string; target: string; days: Set<string>; evidence: DiaryGraphEvidence[] }
  >();
  for (const day of selectedDays) {
    const entityIds = [...day.entities]
      .filter((id) => selectedEntityIds.has(id))
      .sort();
    for (let i = 0; i < entityIds.length; i++) {
      for (let j = i + 1; j < entityIds.length; j++) {
        const source = entityIds[i];
        const target = entityIds[j];
        const id = `co:${source}:${target}`;
        let co = coOccurrences.get(id);
        if (!co) {
          co = { source, target, days: new Set(), evidence: [] };
          coOccurrences.set(id, co);
        }
        co.days.add(day.date);
        addEvidence(
          co.evidence,
          {
            kind: "diary",
            date: day.date,
            vaultPath: `${day.date}.md`,
            label: day.date,
          },
          opts.evidenceLimit
        );
      }
    }
  }
  const rankedCo = [...coOccurrences.entries()]
    .sort((a, b) => b[1].days.size - a[1].days.size || a[0].localeCompare(b[0]))
    .slice(0, opts.coOccurrenceLimit);
  for (const [id, co] of rankedCo) {
    const ev = co.evidence[0] || {
      kind: "diary" as const,
      label: "Shared diary day",
    };
    edges.set(id, {
      id,
      source: co.source,
      target: co.target,
      type: "co_occurs",
      label: "same day",
      weight: co.days.size,
      directed: false,
      evidenceCount: co.days.size,
      evidence: co.evidence.length ? co.evidence : [ev],
    });
  }

  for (const rel of relationships) {
    if (!isEntityKind(rel.subject_kind) || !isEntityKind(rel.object_kind)) continue;
    const source = entityId(rel.subject_kind, rel.subject_norm);
    const target = entityId(rel.object_kind, rel.object_norm);
    if (!selectedEntityIds.has(source) || !selectedEntityIds.has(target)) continue;
    const sourceContent = contentInfo.bySource.get(`${rel.source_kind}\0${rel.source_key}`);
    const label = relationshipLabel(rel.predicate);
    addEdge(
      edges,
      {
        id: `rel:${source}:${rel.predicate}:${target}`,
        source,
        target,
        type: "relationship",
        label,
        predicate: rel.predicate,
        weight: 2,
        directed: true,
      },
      sourceContent
        ? {
            kind: sourceContent.type,
            sourceKey: sourceContent.key,
            date: sourceContent.date,
            vaultPath: sourceContent.vaultPath,
            label: sourceContent.label,
          }
        : {
            kind: "relationship",
            sourceKey: rel.source_key,
            label: `${rel.source_kind}:${rel.source_key}`,
            preview: rel.updated_at,
          },
      opts.evidenceLimit
    );
  }

  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const edgeList = [...edges.values()].filter(
    (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  );
  edgeList.sort(
    (a, b) =>
      (a.type === "relationship" ? -1 : 0) - (b.type === "relationship" ? -1 : 0) ||
      b.weight - a.weight ||
      a.label.localeCompare(b.label)
  );

  const degrees = new Map<string, number>();
  for (const edge of edgeList) {
    degrees.set(edge.source, (degrees.get(edge.source) || 0) + edge.weight);
    degrees.set(edge.target, (degrees.get(edge.target) || 0) + edge.weight);
  }

  const nodeOrder: Record<DiaryGraphNodeType, number> = {
    person: 0,
    place: 1,
    project: 2,
    day: 3,
    conversation: 4,
    reflection: 5,
    decision: 6,
  };
  nodes.sort(
    (a, b) =>
      nodeOrder[a.type] - nodeOrder[b.type] ||
      (degrees.get(b.id) || 0) - (degrees.get(a.id) || 0) ||
      a.label.localeCompare(b.label)
  );

  return {
    generatedAt: new Date().toISOString(),
    nodes,
    edges: edgeList,
    stats: {
      entityCount: nodes.filter((node) => node.kind).length,
      dayCount: nodes.filter((node) => node.type === "day").length,
      contentCount: nodes.filter(
        (node) =>
          node.type === "conversation" ||
          node.type === "reflection" ||
          node.type === "decision"
      ).length,
      relationshipCount: edgeList.filter((edge) => edge.type === "relationship").length,
      mentionEdgeCount: edgeList.filter((edge) => edge.type === "mentions").length,
      coOccurrenceEdgeCount: edgeList.filter((edge) => edge.type === "co_occurs").length,
      totalEntityCount: entities.size,
      totalDayCount: days.size,
      totalContentCount: contents.size,
      totalRelationshipCount: relationships.length,
      topHubs: nodes
        .map((node) => ({
          id: node.id,
          label: node.label,
          type: node.type,
          score: degrees.get(node.id) || 0,
        }))
        .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
        .slice(0, 8),
    },
  };
}
