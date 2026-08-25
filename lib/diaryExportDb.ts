import { db } from "./db";
import { TZ_OFFSET_MIN, parseSqliteUtc } from "./format";
import {
  DISCIPLINE_ID,
  CONVERSATIONS_NOTEBOOK_ID,
  REFLECTIONS_NOTEBOOK_ID,
  DECISIONS_NOTEBOOK_ID,
} from "./notes";
import { allEntityWikiRows } from "./entityWiki";
import { allConversationNotesRows } from "./conversationEntities";
import { allRelationshipRows } from "./entityRelationships";
import { allConversationFileNames } from "./conversationWiki";
import { allReflectionFileNames } from "./reflectionWiki";
import { allDecisionFileNames } from "./decisionWiki";
import { getCurrentProfileRow } from "./profile";
import {
  buildDiaryMarkdown,
  buildDayFiles,
  buildEntityStubFiles,
  buildHomeNote,
  buildEntityIndexNote,
  buildProfileNote,
  carryForwardDates,
  effectiveDateKeys,
  entityStubFileName,
  sanitizeEntityName,
  entityIndexFileName,
  HOME_FILE,
  PROFILE_FILE,
  UNDATED_FILE,
  type DiaryPageRow,
  type EntityStub,
  type EntityIndexEntry,
  type PageEntities,
  type RecentLink,
} from "./diaryExport";

// DB-backed diary Markdown renderer shared by the download route
// (app/api/export/diary) and the Dropbox auto-export (lib/dropbox.ts), so
// both produce byte-identical output from one implementation. The pure
// assembly + carry-forward live in lib/diaryExport.ts (unit-tested); this
// just fetches rows and hands them over.

function fmtExportedAt(): string {
  const nowSqlite = new Date().toISOString().slice(0, 19).replace("T", " ");
  const d = parseSqliteUtc(nowSqlite);
  if (!d) return "";
  return new Date(d.getTime() + TZ_OFFSET_MIN * 60 * 1000)
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
}

// Canonical display name per (kind, name_norm), reusing the exact
// MIN(name) GROUP BY name_norm convention already used by
// lib/mind.ts:getTopEntities and the top_entities chat tool
// (lib/chatTools.ts) — so the diary export, /mind, and chat all agree on
// one display casing per real-world entity. One aggregate query for the
// whole table; joined to per-page rows in JS below (no N+1).
//
// MUST join through pages and apply the same notebook_id != DISCIPLINE_ID
// scope as the exported rows (and as getTopEntities/topEntities) — without
// it, a discipline-notebook entity with a lexicographically smaller name
// could win MIN(name) and leak an entity spelling into the diary export
// that the diary's own (discipline-excluded) data never produced (the review,
// PR #101).
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
  const map = new Map<string, string>();
  // Space-joined key: kind is always one of a fixed 3-value enum with no
  // whitespace of its own, so this key is unambiguous even though
  // name_norm is free text.
  for (const r of rows) map.set(`${r.kind} ${r.name_norm}`, r.canonical_name);
  return map;
}

type EntityIdentity = {
  kind: string;
  name_norm: string;
  display_name: string;
};

// Sanitization is deliberately lossy, so distinct canonical identities can
// occasionally converge on one established vault path (for example A/B and
// A:B). Keep the historical mapping untouched, but make the collision visible
// so the owner can merge or rename the source entities deliberately.
function warnOnEntityStubCollisions(canonicalNames: Map<string, string>): void {
  const rows = db()
    .prepare(
      `SELECT e.kind, e.name_norm, MIN(e.name) AS display_name
       FROM entry_entities e
       JOIN pages p ON p.id = e.page_id
       WHERE p.notebook_id != ?
       GROUP BY e.kind, e.name_norm
       UNION ALL
       SELECT kind, name_norm, name AS display_name FROM entity_wiki
       UNION ALL
       SELECT kind, name_norm, name AS display_name FROM entity_conversation_notes
       UNION ALL
       SELECT subject_kind AS kind, subject_norm AS name_norm,
              subject_name AS display_name FROM entity_relationships
       UNION ALL
       SELECT object_kind AS kind, object_norm AS name_norm,
              object_name AS display_name FROM entity_relationships`
    )
    .all(DISCIPLINE_ID) as EntityIdentity[];

  const byStub = new Map<
    string,
    Map<string, { nameNorm: string; name: string }>
  >();
  for (const row of rows) {
    if (row.kind !== "person" && row.kind !== "place" && row.kind !== "project") {
      continue;
    }
    const identityKey = `${row.kind}\0${row.name_norm}`;
    const name =
      canonicalNames.get(`${row.kind} ${row.name_norm}`) ?? row.display_name;
    const stubName = sanitizeEntityName(name) || "unnamed";
    const stubKey = `${row.kind}\0${stubName}`;
    let identities = byStub.get(stubKey);
    if (!identities) {
      identities = new Map();
      byStub.set(stubKey, identities);
    }
    if (!identities.has(identityKey)) {
      identities.set(identityKey, { nameNorm: row.name_norm, name });
    }
  }

  for (const [stubKey, identities] of byStub) {
    if (identities.size < 2) continue;
    const separator = stubKey.indexOf("\0");
    const kind = stubKey.slice(0, separator) as EntityStub["kind"];
    const stubName = stubKey.slice(separator + 1);
    const sources = [...identities.values()].sort(
      (a, b) => a.nameNorm.localeCompare(b.nameNorm) || a.name.localeCompare(b.name)
    );
    console.warn(
      `[diary-export] Distinct ${kind} entities resolve to the same existing ` +
        `stub path ${JSON.stringify(entityStubFileName(kind, stubName))}: ` +
        `${sources.map((source) => JSON.stringify(source)).join(", ")}. ` +
        "The filename mapping was preserved; merge or rename the source entities to resolve it."
    );
  }
}

// Shared fetch: all diary pages (discipline, mcp-conversations, AND
// mcp-reflections notebooks excluded — their synthetic pages are
// bookkeeping devices, not real diary entries, and already get their own
// note via lib/conversationWiki.ts/lib/reflectionWiki.ts's renderNote
// functions; a day file too would duplicate them) in notebook-walk order so
// carry-forward is correct, plus the per-page entity map (canonical,
// sanitized display names — see fetchCanonicalEntityNames/sanitizeEntityName
// above).
function fetchDiaryData(): {
  rows: DiaryPageRow[];
  entitiesByPage: Map<string, PageEntities>;
} {
  const rows = db()
    .prepare(
      `SELECT p.id, p.notebook_id, p.entry_date, p.page_index, p.ocr_text,
              n.name AS notebook_name,
              a.themes, a.sentiment
       FROM pages p
       JOIN notebooks n ON n.id = p.notebook_id
       LEFT JOIN entry_analysis a ON a.page_id = p.id
       WHERE p.ocr_text IS NOT NULL AND p.ocr_text != ''
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
    ) as DiaryPageRow[];

  const canonicalNames = fetchCanonicalEntityNames();
  const entityRows = db()
    .prepare(
      `SELECT page_id, kind, name_norm FROM entry_entities ORDER BY kind, name_norm`
    )
    .all() as Array<{ page_id: string; kind: string; name_norm: string }>;
  const entitiesByPage = new Map<string, PageEntities>();
  for (const e of entityRows) {
    let bucket = entitiesByPage.get(e.page_id);
    if (!bucket) {
      bucket = { person: [], place: [], project: [] };
      entitiesByPage.set(e.page_id, bucket);
    }
    if (e.kind === "person" || e.kind === "place" || e.kind === "project") {
      const canonical =
        canonicalNames.get(`${e.kind} ${e.name_norm}`) ?? e.name_norm;
      bucket[e.kind].push(sanitizeEntityName(canonical));
    }
  }
  return { rows, entitiesByPage };
}

// One combined Markdown document — used by the download route.
export function renderDiaryMarkdown(): string {
  const { rows, entitiesByPage } = fetchDiaryData();
  return buildDiaryMarkdown({ rows, entitiesByPage, exportedAt: fmtExportedAt() });
}

// One file per day (+ undated.md) — used by the Dropbox per-day export.
// Map key is the filename (e.g. "2026-06-19.md").
export function renderDiaryDayFiles(): Map<string, string> {
  const { rows, entitiesByPage } = fetchDiaryData();
  return buildDayFiles({ rows, entitiesByPage, exportedAt: fmtExportedAt() });
}

// Compute the full EntityStub[] (one per person/place/project) from the
// diary walk + conversation/reflection/decision tags — the shared source of truth for
// both the stub notes (renderEntityStubFiles) and the entity index notes
// (renderVaultStructureFiles), so an entity's day count is identical in both.
export function collectEntityStubs(): EntityStub[] {
  const { rows, entitiesByPage } = fetchDiaryData();
  const enriched = carryForwardDates(rows);
  const canonicalNames = fetchCanonicalEntityNames();
  warnOnEntityStubCollisions(canonicalNames);
  // Claude-written profiles (one query), keyed by the SAME sanitized display
  // name the stub is keyed by, so the wiki body attaches to the right note.
  const summaryByKey = new Map<string, string>();
  for (const w of allEntityWikiRows()) {
    summaryByKey.set(`${w.kind}|${sanitizeEntityName(w.name)}`, w.summary);
  }
  // The librarian's own "Recent conversations" notes — a separate table from
  // entity_wiki (lib/conversationEntities.ts), keyed the same way so it
  // attaches to the same stub without either author's writes colliding.
  const notesByKey = new Map<string, string>();
  for (const n of allConversationNotesRows()) {
    notesByKey.set(`${n.kind}|${sanitizeEntityName(n.name)}`, n.notes);
  }

  type Acc = {
    kind: EntityStub["kind"];
    name: string;
    dates: Set<string>;
    undated: boolean;
  };
  const acc = new Map<string, Acc>();
  for (const e of enriched) {
    const ent = entitiesByPage.get(e.row.id);
    if (!ent) continue;
    for (const kind of ["person", "place", "project"] as const) {
      for (const name of ent[kind]) {
        if (!name) continue;
        // \0 separates a fixed-enum kind from the free-text name.
        const key = `${kind}\0${name}`;
        let a = acc.get(key);
        if (!a) {
          a = { kind, name, dates: new Set(), undated: false };
          acc.set(key, a);
        }
        if (e.effectiveDate) a.dates.add(e.effectiveDate);
        else a.undated = true;
      }
    }
  }

  // Entities that only ever appear on a librarian-tagged conversation,
  // reflection, or decision page (lib/entityTagging.ts /
  // lib/conversationEntities.ts's tag_conversation_entities /
  // lib/reflectionEntities.ts's tagReflectionEntities /
  // lib/decisionEntities.ts's tagDecisionEntities) don't appear in `acc` at all
  // — the diary walk above only ever sees `rows` from fetchDiaryData, which
  // deliberately EXCLUDES those synthetic notebooks (their pages aren't real
  // diary entries). Unlike that exclusion, stub generation is meant to stay
  // inclusive of conversation/reflection/decision-tagged entities (see the
  // notebook-exclusion table in the design), so add a bare entry for
  // anything tagged there — canonical-name resolution reuses the same
  // fetchCanonicalEntityNames() the diary walk already relies on, so a
  // conversation/reflection/decision-only tag and a diary mention of the same
  // person converge on one casing/stub. This same pass also builds the direct
  // back-links to the tagged note itself (Phase C's "## Related notes" section)
  // — one query, not two.
  const relationshipsByKey = new Map<
    string,
    Array<{ predicate: string; otherName: string; direction: "out" | "in" }>
  >();
  const seenRelationshipsByKey = new Map<string, Set<string>>();
  const addRelationship = (
    key: string,
    rel: { predicate: string; otherName: string; direction: "out" | "in" }
  ) => {
    let seen = seenRelationshipsByKey.get(key);
    if (!seen) {
      seen = new Set();
      seenRelationshipsByKey.set(key, seen);
    }
    const dedupeKey = `${rel.direction}\0${rel.predicate}\0${rel.otherName}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    let list = relationshipsByKey.get(key);
    if (!list) {
      list = [];
      relationshipsByKey.set(key, list);
    }
    list.push(rel);
  };

  for (const r of allRelationshipRows()) {
    const subjectName = sanitizeEntityName(
      canonicalNames.get(`${r.subject_kind} ${r.subject_norm}`) ?? r.subject_name
    );
    const objectName = sanitizeEntityName(
      canonicalNames.get(`${r.object_kind} ${r.object_norm}`) ?? r.object_name
    );
    if (!subjectName || !objectName) continue;
    const subjectKey = `${r.subject_kind}\0${subjectName}`;
    const objectKey = `${r.object_kind}\0${objectName}`;
    if (!acc.has(subjectKey)) {
      acc.set(subjectKey, {
        kind: r.subject_kind,
        name: subjectName,
        dates: new Set(),
        undated: false,
      });
    }
    if (!acc.has(objectKey)) {
      acc.set(objectKey, {
        kind: r.object_kind,
        name: objectName,
        dates: new Set(),
        undated: false,
      });
    }
    addRelationship(subjectKey, {
      predicate: r.predicate,
      otherName: objectName,
      direction: "out",
    });
    addRelationship(objectKey, {
      predicate: r.predicate,
      otherName: subjectName,
      direction: "in",
    });
  }

  const fileNamesByNotebook: Record<string, Map<string, string>> = {
    [CONVERSATIONS_NOTEBOOK_ID]: allConversationFileNames(),
    [REFLECTIONS_NOTEBOOK_ID]: allReflectionFileNames(),
    [DECISIONS_NOTEBOOK_ID]: allDecisionFileNames(),
  };
  const relatedLinksByKey = new Map<string, Set<string>>();
  const linkedContentTagged = db()
    .prepare(
      `SELECT e.kind, e.name_norm, p.id AS page_id, p.notebook_id
       FROM entry_entities e JOIN pages p ON p.id = e.page_id
       WHERE p.notebook_id IN (?, ?, ?)`
    )
    .all(CONVERSATIONS_NOTEBOOK_ID, REFLECTIONS_NOTEBOOK_ID, DECISIONS_NOTEBOOK_ID) as Array<{
    kind: string;
    name_norm: string;
    page_id: string;
    notebook_id: string;
  }>;
  for (const row of linkedContentTagged) {
    if (row.kind !== "person" && row.kind !== "place" && row.kind !== "project") {
      continue;
    }
    const canonical = sanitizeEntityName(
      canonicalNames.get(`${row.kind} ${row.name_norm}`) ?? row.name_norm
    );
    // \0 separator to match the diary walk's acc key above — a plain space
    // would silently create a SECOND acc entry for the same entity whenever
    // sanitizeEntityName's output contains a space (i.e. almost always),
    // clobbering nothing but also never matching, and losing the diary dates.
    const key = `${row.kind}\0${canonical}`;
    if (!acc.has(key)) {
      acc.set(key, {
        kind: row.kind,
        name: canonical,
        dates: new Set(),
        undated: false,
      });
    }
    // pages.id is "<notebook_id>:<content_key>" (conversationPageId/
    // reflectionPageId/decisionPageId), so strip the known prefix to recover
    // the key and look up that note's filename.
    const contentKey = row.page_id.slice(row.notebook_id.length + 1);
    const fileName = fileNamesByNotebook[row.notebook_id]?.get(contentKey);
    if (fileName) {
      const target = fileName.replace(/^[^/]+\//, "").replace(/\.md$/, "");
      let set = relatedLinksByKey.get(key);
      if (!set) {
        set = new Set();
        relatedLinksByKey.set(key, set);
      }
      set.add(target);
    }
  }

  // An entity can also have librarian NOTES without ever having been tagged
  // via tag_conversation_entities (e.g. update_entity_conversation_notes
  // called on its own) — give those a bare stub too, same reasoning as above.
  for (const n of allConversationNotesRows()) {
    const canonical = sanitizeEntityName(n.name);
    const key = `${n.kind}\0${canonical}`;
    if (!acc.has(key)) {
      acc.set(key, {
        kind: n.kind as EntityStub["kind"],
        name: canonical,
        dates: new Set(),
        undated: false,
      });
    }
  }

  const stubs: EntityStub[] = [...acc.values()].map((a) => {
    const relatedNoteLinks = relatedLinksByKey.get(`${a.kind}\0${a.name}`);
    return {
      kind: a.kind,
      name: a.name,
      dates: [...a.dates].sort(),
      undated: a.undated,
      summary: summaryByKey.get(`${a.kind}|${a.name}`) ?? null,
      conversationNotes: notesByKey.get(`${a.kind}|${a.name}`) ?? null,
      relatedNoteLinks: relatedNoteLinks ? [...relatedNoteLinks].sort() : undefined,
      relationships: relationshipsByKey.get(`${a.kind}\0${a.name}`),
    };
  });
  stubs.sort((x, y) => x.kind.localeCompare(y.kind) || x.name.localeCompare(y.name));
  return stubs;
}

// One note per person/place/project (People/…, Places/…, Projects/…) so the
// day files' [[wikilinks]] resolve to a real page. Reuses fetchDiaryData +
// carry-forward so an entity's day list matches exactly where it's mentioned.
export function renderEntityStubFiles(): Map<string, string> {
  return buildEntityStubFiles({ stubs: collectEntityStubs(), exportedAt: fmtExportedAt() });
}

// Current entity-stub paths after all diary tags, conversation/reflection/decision
// tags, librarian notes, and typed relationships are applied. Used by
// incremental export paths that need to distinguish "rewrite this touched
// stub" from "delete this now-orphaned touched stub".
export function currentEntityStubFileNames(): string[] {
  return collectEntityStubs().map((stub) => entityStubFileName(stub.kind, stub.name));
}

// The fixed vault-root "second brain" note names, so the incremental Dropbox
// export can always refresh them alongside a notebook's day/stub files
// (they reflect global counts, so any ingest can change them). Profile.md is
// listed unconditionally; the exporter filters to files actually present, so
// it's skipped when no profile exists yet.
export function vaultStructureFileNames(): string[] {
  return [
    HOME_FILE,
    entityIndexFileName("person"),
    entityIndexFileName("place"),
    entityIndexFileName("project"),
    PROFILE_FILE,
  ];
}

// Most-recent (up to 5) rows of a conversation/reflection table as RecentLink
// entries — each resolved to its note's bare wikilink target via the supplied
// key→filename map. Rows whose note isn't filed yet are skipped.
function recentContentLinks(
  table: "mcp_conversations" | "mcp_reflections" | "mcp_decisions",
  keyCol: "conversation_key" | "reflection_key" | "decision_key",
  fileNames: Map<string, string>
): RecentLink[] {
  const rows = db()
    .prepare(
      `SELECT ${keyCol} AS key, title, created_at FROM ${table}
       ORDER BY created_at DESC LIMIT 5`
    )
    .all() as Array<{ key: string; title: string | null; created_at: string }>;
  const out: RecentLink[] = [];
  for (const r of rows) {
    const fname = fileNames.get(r.key);
    if (!fname) continue;
    const target = fname.replace(/^[^/]+\//, "").replace(/\.md$/, "");
    out.push({ target, label: (r.title || "").trim() || target });
  }
  return out;
}

// The "second brain" structure notes: Home dashboard, People/Places/Projects
// index MOCs, and the Profile note. Generated deterministically from
// Remarkabler's own data (so the app stays the SOLE writer), refreshed on
// every sync. Entity day-counts come from the SAME collectEntityStubs() the
// stub notes use, so the index and the stub never disagree.
export function renderVaultStructureFiles(): Map<string, string> {
  const exportedAt = fmtExportedAt();
  const files = new Map<string, string>();

  // Entity indexes, split from the shared stub computation.
  const stubs = collectEntityStubs();
  const byKind: Record<EntityStub["kind"], EntityIndexEntry[]> = {
    person: [],
    place: [],
    project: [],
  };
  for (const s of stubs) byKind[s.kind].push({ name: s.name, days: s.dates.length });
  for (const kind of ["person", "place", "project"] as const) {
    files.set(
      entityIndexFileName(kind),
      buildEntityIndexNote({ kind, entries: byKind[kind], exportedAt })
    );
  }

  // Diary days (distinct carried-forward effective dates), most recent first.
  const { rows } = fetchDiaryData();
  const dayset = new Set<string>();
  for (const e of carryForwardDates(rows)) if (e.effectiveDate) dayset.add(e.effectiveDate);
  const days = [...dayset].sort(); // ascending
  const recentDays: RecentLink[] = days
    .slice(-5)
    .reverse()
    .map((d) => ({ target: d, label: d }));

  const reflections = (
    db().prepare(`SELECT COUNT(*) AS c FROM mcp_reflections`).get() as { c: number }
  ).c;
  const conversations = (
    db().prepare(`SELECT COUNT(*) AS c FROM mcp_conversations`).get() as { c: number }
  ).c;
  const decisions = (
    db().prepare(`SELECT COUNT(*) AS c FROM mcp_decisions`).get() as { c: number }
  ).c;
  const profileRow = getCurrentProfileRow();

  files.set(
    HOME_FILE,
    buildHomeNote({
      stats: {
        diaryDays: days.length,
        people: byKind.person.length,
        places: byKind.place.length,
        projects: byKind.project.length,
        reflections,
        conversations,
        decisions,
      },
      recentDays,
      recentReflections: recentContentLinks(
        "mcp_reflections",
        "reflection_key",
        allReflectionFileNames()
      ),
      recentConversations: recentContentLinks(
        "mcp_conversations",
        "conversation_key",
        allConversationFileNames()
      ),
      recentDecisions: recentContentLinks(
        "mcp_decisions",
        "decision_key",
        allDecisionFileNames()
      ),
      hasProfile: !!profileRow,
      exportedAt,
    })
  );

  if (profileRow) {
    files.set(
      PROFILE_FILE,
      buildProfileNote({
        profile: profileRow.content,
        updatedAt: profileRow.created_at,
        exportedAt,
      })
    );
  }

  return files;
}

// The stub file path (e.g. "People/야오팡.md") for a raw entity display name,
// using the SAME sanitisation the export used to write it. Lets the merge
// path delete the stub of an entity that was merged away.
export function entityStubRelPathForName(
  kind: "person" | "place" | "project",
  rawName: string
): string {
  return entityStubFileName(kind, sanitizeEntityName(rawName));
}

// The entity-stub file names one notebook's pages touch, so the incremental
// Dropbox export can refresh just those stubs. Excludes the discipline
// notebook (returns [] for it).
export function affectedEntityStubFileNames(notebookId: string): string[] {
  if (notebookId === DISCIPLINE_ID) return [];
  const canonical = fetchCanonicalEntityNames();
  const rows = db()
    .prepare(
      `SELECT DISTINCT e.kind, e.name_norm
       FROM entry_entities e
       JOIN pages p ON p.id = e.page_id
       WHERE p.notebook_id = ? AND p.ocr_text IS NOT NULL AND p.ocr_text != ''`
    )
    .all(notebookId) as Array<{ kind: string; name_norm: string }>;
  const names: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.kind !== "person" && r.kind !== "place" && r.kind !== "project") continue;
    const canonicalName =
      canonical.get(`${r.kind} ${r.name_norm}`) ?? r.name_norm;
    const fname = entityStubFileName(r.kind, sanitizeEntityName(canonicalName));
    if (seen.has(fname)) continue;
    seen.add(fname);
    names.push(fname);
  }
  return names;
}

/**
 * The day-file names one notebook's pages could have changed, so the
 * Dropbox export can re-upload just those instead of the whole vault.
 * Excludes the discipline notebook (returns [] for it).
 */
export function affectedDayFileNames(notebookId: string): string[] {
  // None of the three synthetic notebooks produce day files — discipline
  // never has, and mcp-conversations/mcp-reflections/mcp-decisions pages each
  // get their own note instead, per the fetchDiaryData exclusion above.
  if (
    notebookId === DISCIPLINE_ID ||
    notebookId === CONVERSATIONS_NOTEBOOK_ID ||
    notebookId === REFLECTIONS_NOTEBOOK_ID ||
    notebookId === DECISIONS_NOTEBOOK_ID
  ) {
    return [];
  }
  const rows = db()
    .prepare(
      `SELECT notebook_id, entry_date
       FROM pages
       WHERE notebook_id = ? AND ocr_text IS NOT NULL AND ocr_text != ''
       ORDER BY page_index ASC`
    )
    .all(notebookId) as Array<{ notebook_id: string; entry_date: string | null }>;
  const { dates, hasUndated } = effectiveDateKeys(rows);
  const names = dates.map((d) => `${d}.md`);
  if (hasUndated) names.push(UNDATED_FILE);
  return names;
}
