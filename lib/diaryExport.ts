// Pure Markdown assembly for the diary export (app/api/export/diary).
// Kept out of the route handler so the grouping / ordering / rendering
// logic is unit-testable without spinning up Next — the same pattern as
// lib/chatMemoryBackfill.ts. No DB, no I/O here; the route fetches rows
// and hands them in.

export type DiaryPageRow = {
  id: string;
  notebook_id: string;
  notebook_name: string;
  page_index: number;
  entry_date: string | null;
  ocr_text: string;
  themes: string | null;
  sentiment: number | null;
};

// Entity arrays hold CANONICAL, sanitized display names (one consistent
// casing per real-world entity, resolved by the DB layer via MIN(name)
// GROUP BY name_norm — see lib/diaryExportDb.ts:fetchCanonicalEntityNames),
// not each page's raw per-page casing. This is what lets every mention of
// the same person/place/project across the whole diary link to the SAME
// Obsidian wikilink target, so the graph view coalesces them into one node
// instead of splitting "Jin" and "jin" into two.
export type PageEntities = {
  person: string[];
  place: string[];
  project: string[];
};

// "none" is the sentinel written by extractEntryDate when a page has no
// parseable diary timestamp; NULL means never parsed. Both are "undated".
export function isDatedEntry(entryDate: string | null): boolean {
  return !!entryDate && entryDate !== "none";
}

export function parseThemes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

// Carry the last-seen diary date forward within each notebook, in page
// order — the same rule as reparseAllEntryDates (lib/notes.ts), but
// read-only. The user writes a "YYYY-MM-DD-HHMM-KST" header once per
// session; continuation pages inherit it. Without this, a freshly
// processed multi-page notebook (whose continuation pages still read
// entry_date='none' until a reparse sweep runs) would scatter its later
// pages into the "Undated" section instead of under their day.
//
// `rows` MUST arrive grouped by notebook, in page order (the route orders
// by synced_at, notebook_id, page_index). We reset the carry at each
// notebook boundary defensively regardless.
export type EnrichedRow = { row: DiaryPageRow; effectiveDate: string | null };

export function carryForwardDates(rows: DiaryPageRow[]): EnrichedRow[] {
  const out: EnrichedRow[] = [];
  let currentNotebook: string | null = null;
  let carry: string | null = null;
  for (const row of rows) {
    if (row.notebook_id !== currentNotebook) {
      currentNotebook = row.notebook_id;
      carry = null;
    }
    if (isDatedEntry(row.entry_date)) {
      carry = row.entry_date;
    }
    // Pages before the first dated page in a notebook keep a null effective
    // date and fall to the "Undated" section.
    out.push({ row, effectiveDate: isDatedEntry(row.entry_date) ? row.entry_date : carry });
  }
  return out;
}

// Obsidian wikilink syntax. Names are already sanitized (see
// lib/diaryExportDb.ts) so this is a plain wrap, not a second escape pass.
function wikilink(name: string): string {
  return `[[${name}]]`;
}

function pageMetaLine(
  r: DiaryPageRow,
  entities: PageEntities | undefined
): string {
  const parts: string[] = [`notebook: ${r.notebook_name}`];
  const themes = parseThemes(r.themes);
  if (themes.length) parts.push(`themes: ${themes.join(", ")}`);
  if (typeof r.sentiment === "number")
    parts.push(`sentiment: ${r.sentiment.toFixed(2)}`);
  if (entities) {
    if (entities.person.length)
      parts.push(`people: ${entities.person.map(wikilink).join(", ")}`);
    if (entities.place.length)
      parts.push(`places: ${entities.place.map(wikilink).join(", ")}`);
    if (entities.project.length)
      parts.push(`projects: ${entities.project.map(wikilink).join(", ")}`);
  }
  return `_${parts.join(" · ")}_`;
}

// Render a string as a double-quoted YAML scalar, escaping backslashes and
// double quotes and flattening newlines. Entity names are free-text from
// Claude's extraction — a bare ":" would corrupt YAML block-mapping
// parsing, "#" could be read as a comment, etc. Quoting sidesteps all of
// that. Exported for direct unit testing.
export function yamlQuoted(value: string): string {
  const flat = value.replace(/\r?\n/g, " ");
  return `"${flat.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// One YAML block-sequence line per name, each item a wikilink, e.g.:
//   people:
//     - "[[Jin]]"
// Returns [] (omits the key entirely) when there are no names, matching
// the existing "omit absent metadata" convention used elsewhere in this
// file (themes, sentiment, range).
function yamlWikilinkListLines(key: string, names: string[]): string[] {
  if (!names.length) return [];
  const lines = [`${key}:`];
  for (const n of names) lines.push(`  - ${yamlQuoted(wikilink(n))}`);
  return lines;
}

// Union of entities across a set of pages, deduplicated and sorted for
// deterministic output — used for day-file and whole-document frontmatter
// arrays (a per-page line is already rendered via pageMetaLine).
function collectEntities(
  pages: DiaryPageRow[],
  entitiesByPage: Map<string, PageEntities>
): PageEntities {
  const person = new Set<string>();
  const place = new Set<string>();
  const project = new Set<string>();
  for (const p of pages) {
    const e = entitiesByPage.get(p.id);
    if (!e) continue;
    e.person.forEach((n) => person.add(n));
    e.place.forEach((n) => place.add(n));
    e.project.forEach((n) => project.add(n));
  }
  return {
    person: [...person].sort(),
    place: [...place].sort(),
    project: [...project].sort(),
  };
}

/**
 * Build the full diary Markdown document.
 *
 * `rows` MUST arrive grouped by notebook, in page order (so date
 * carry-forward is correct). Day grouping and chronological ordering are
 * computed here from the carried-forward effective dates, so the caller
 * does not need to pre-sort by date.
 */
export function buildDiaryMarkdown(opts: {
  rows: DiaryPageRow[];
  entitiesByPage: Map<string, PageEntities>;
  exportedAt: string;
}): string {
  const { rows, entitiesByPage, exportedAt } = opts;

  const enriched = carryForwardDates(rows);

  // Group dated pages by their effective date, preserving insertion
  // (notebook/page) order within each day. Sort day keys — YYYY-MM-DD
  // sorts lexicographically, which is chronological.
  const byDate = new Map<string, DiaryPageRow[]>();
  const undated: DiaryPageRow[] = [];
  for (const e of enriched) {
    if (e.effectiveDate === null) {
      undated.push(e.row);
      continue;
    }
    const list = byDate.get(e.effectiveDate);
    if (list) list.push(e.row);
    else byDate.set(e.effectiveDate, [e.row]);
  }
  const sortedDates = [...byDate.keys()].sort();

  const firstDate = sortedDates.length ? sortedDates[0] : "";
  const lastDate = sortedDates.length ? sortedDates[sortedDates.length - 1] : "";
  const notebookCount = new Set(rows.map((r) => r.notebook_name)).size;
  const docEntities = collectEntities(rows, entitiesByPage);

  const lines: string[] = [];

  lines.push("---");
  lines.push('title: "My Diary"');
  lines.push("source: Remarkabler");
  lines.push(`exported: ${exportedAt || "unknown"}`);
  lines.push(`pages: ${rows.length}`);
  lines.push(`notebooks: ${notebookCount}`);
  if (firstDate && lastDate) lines.push(`range: ${firstDate} → ${lastDate}`);
  lines.push(...yamlWikilinkListLines("people", docEntities.person));
  lines.push(...yamlWikilinkListLines("places", docEntities.place));
  lines.push(...yamlWikilinkListLines("projects", docEntities.project));
  lines.push("---");
  lines.push("");
  lines.push("# My Diary");
  lines.push("");
  lines.push(
    "_Your handwritten diary, transcribed by Claude and exported as plain " +
      "Markdown you own. Entries are ordered by the date you wrote them, " +
      "oldest first._"
  );
  lines.push("");

  if (rows.length === 0) {
    lines.push("_No transcribed diary pages yet._");
    lines.push("");
  }

  for (const d of sortedDates) {
    lines.push("---");
    lines.push("");
    lines.push(`## ${d}`);
    lines.push("");
    for (const r of byDate.get(d) as DiaryPageRow[]) {
      lines.push(pageMetaLine(r, entitiesByPage.get(r.id)));
      lines.push("");
      lines.push(r.ocr_text.trim());
      lines.push("");
    }
  }

  if (undated.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Undated entries");
    lines.push("");
    lines.push(
      "_Pages with no diary timestamp to parse. Grouped by notebook._"
    );
    lines.push("");
    let currentNotebook = "";
    for (const r of undated) {
      if (r.notebook_name !== currentNotebook) {
        lines.push(`### ${r.notebook_name}`);
        lines.push("");
        currentNotebook = r.notebook_name;
      }
      lines.push(`_page ${r.page_index + 1}_`);
      lines.push("");
      lines.push(r.ocr_text.trim());
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push("_End of diary export._");
  lines.push("");

  return lines.join("\n");
}

// ── Per-day file export ────────────────────────────────────────────────────
// Instead of one combined document, produce one Markdown file per day
// (plus an "undated.md" when needed) — a proper daily-notes vault for
// Obsidian and a natural backup layout. Same carry-forward + metadata rules
// as buildDiaryMarkdown; the map key is the filename.

/**
 * Effective date keys touched by a set of rows (for one notebook), using the
 * same carry-forward rule. Lets the Dropbox export upload ONLY the day files
 * a freshly-ingested notebook could have changed, instead of re-uploading
 * the whole vault every time. `rows` must be that notebook's pages in page
 * order.
 */
export function effectiveDateKeys(
  rows: Array<{ notebook_id: string; entry_date: string | null }>
): { dates: string[]; hasUndated: boolean } {
  const dates = new Set<string>();
  let hasUndated = false;
  let currentNotebook: string | null = null;
  let carry: string | null = null;
  for (const r of rows) {
    if (r.notebook_id !== currentNotebook) {
      currentNotebook = r.notebook_id;
      carry = null;
    }
    if (isDatedEntry(r.entry_date)) carry = r.entry_date;
    const eff = isDatedEntry(r.entry_date) ? r.entry_date : carry;
    if (eff) dates.add(eff);
    else hasUndated = true;
  }
  return { dates: [...dates], hasUndated };
}

// The filename for undated pages within the export folder.
export const UNDATED_FILE = "undated.md";

function renderDayFile(
  date: string,
  pages: DiaryPageRow[],
  entitiesByPage: Map<string, PageEntities>,
  exportedAt: string
): string {
  const notebooks = new Set(pages.map((p) => p.notebook_name));
  const dayEntities = collectEntities(pages, entitiesByPage);
  const lines: string[] = [];
  lines.push("---");
  lines.push(`title: "${date}"`);
  lines.push("source: Remarkabler");
  lines.push(`date: ${date}`);
  lines.push(`notebooks: ${notebooks.size}`);
  lines.push(`pages: ${pages.length}`);
  lines.push(...yamlWikilinkListLines("people", dayEntities.person));
  lines.push(...yamlWikilinkListLines("places", dayEntities.place));
  lines.push(...yamlWikilinkListLines("projects", dayEntities.project));
  lines.push(`exported: ${exportedAt || "unknown"}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${date}`);
  lines.push("");
  for (const r of pages) {
    lines.push(pageMetaLine(r, entitiesByPage.get(r.id)));
    lines.push("");
    lines.push(r.ocr_text.trim());
    lines.push("");
  }
  return lines.join("\n");
}

function renderUndatedFile(
  pages: DiaryPageRow[],
  entitiesByPage: Map<string, PageEntities>,
  exportedAt: string
): string {
  const undatedEntities = collectEntities(pages, entitiesByPage);
  const lines: string[] = [];
  lines.push("---");
  lines.push('title: "Undated entries"');
  lines.push("source: Remarkabler");
  lines.push(`pages: ${pages.length}`);
  lines.push(...yamlWikilinkListLines("people", undatedEntities.person));
  lines.push(...yamlWikilinkListLines("places", undatedEntities.place));
  lines.push(...yamlWikilinkListLines("projects", undatedEntities.project));
  lines.push(`exported: ${exportedAt || "unknown"}`);
  lines.push("---");
  lines.push("");
  lines.push("# Undated entries");
  lines.push("");
  lines.push("_Pages with no diary timestamp to parse. Grouped by notebook._");
  lines.push("");
  let currentNotebook = "";
  for (const r of pages) {
    if (r.notebook_name !== currentNotebook) {
      lines.push(`### ${r.notebook_name}`);
      lines.push("");
      currentNotebook = r.notebook_name;
    }
    lines.push(`_page ${r.page_index + 1}_`);
    lines.push("");
    lines.push(r.ocr_text.trim());
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Build a map of { filename → Markdown } — one file per day (`2026-06-19.md`)
 * plus `undated.md` if there are undated pages. `rows` must arrive grouped
 * by notebook, in page order.
 */
export function buildDayFiles(opts: {
  rows: DiaryPageRow[];
  entitiesByPage: Map<string, PageEntities>;
  exportedAt: string;
}): Map<string, string> {
  const { rows, entitiesByPage, exportedAt } = opts;
  const enriched = carryForwardDates(rows);

  const byDate = new Map<string, DiaryPageRow[]>();
  const undated: DiaryPageRow[] = [];
  for (const e of enriched) {
    if (e.effectiveDate === null) {
      undated.push(e.row);
      continue;
    }
    const list = byDate.get(e.effectiveDate);
    if (list) list.push(e.row);
    else byDate.set(e.effectiveDate, [e.row]);
  }

  const files = new Map<string, string>();
  for (const [date, pages] of byDate) {
    files.set(`${date}.md`, renderDayFile(date, pages, entitiesByPage, exportedAt));
  }
  if (undated.length > 0) {
    files.set(UNDATED_FILE, renderUndatedFile(undated, entitiesByPage, exportedAt));
  }
  return files;
}

// ── Entity stub notes ──────────────────────────────────────────────────────
// One Markdown note per person/place/project so the [[wikilinks]] in the day
// files resolve to a real page instead of an "unresolved" graph node. Each
// stub lists the days that entity appears (as [[YYYY-MM-DD]] links back to the
// day files); Obsidian's backlinks panel derives the same list live, so even a
// slightly stale stub stays useful. Filed under People/ Places/ Projects/ —
// Obsidian resolves wikilinks by basename vault-wide, so the folder is just
// for tidiness.

export type EntityStub = {
  kind: "person" | "place" | "project";
  name: string; // canonical, already sanitized (see lib/diaryExportDb.ts)
  dates: string[]; // day keys this entity appears on
  undated: boolean; // also appears on at least one undated page
  summary?: string | null; // Claude-written wiki profile (lib/entityWiki.ts)
  // The librarian agent's own notes, from subscription conversations — a
  // SEPARATE field/table (entity_conversation_notes) from `summary` above, so
  // the two authors (in-app diary bio vs. the librarian) never clobber each
  // other. See lib/conversationEntities.ts.
  conversationNotes?: string | null;
  // Bare-basename wikilink targets (no folder, no .md) to every tagged
  // conversation/reflection note that mentions this entity — the reverse
  // direction of renderConversationNote/renderReflectionNote's own
  // "## Connects to" section. Sorted; a note's leading YYYY-MM-DD gives
  // chronological order for free. See lib/diaryExportDb.ts.
  relatedNoteLinks?: string[];
};

const ENTITY_STUB_FOLDER: Record<EntityStub["kind"], string> = {
  person: "People",
  place: "Places",
  project: "Projects",
};

// Turn a (kind, canonical name) into the stub's vault path. The basename MUST
// equal the wikilink text the day files emit so [[Jin]] resolves here. Callers
// pass names already run through lib/diaryExportDb.ts:sanitizeEntityName, which
// strips the same path chars — so the day-file wikilink and this basename are
// identically normalized and always match. The strip below is an idempotent
// safety net for any caller that hasn't pre-sanitized.
export function entityStubFileName(
  kind: EntityStub["kind"],
  name: string
): string {
  const base =
    name
      .replace(/[/\\:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "unnamed";
  return `${ENTITY_STUB_FOLDER[kind]}/${base}.md`;
}

function renderEntityStub(stub: EntityStub, exportedAt: string): string {
  const dayCount = stub.dates.length + (stub.undated ? 1 : 0);
  const lines: string[] = [];
  lines.push("---");
  lines.push(`title: ${yamlQuoted(stub.name)}`);
  lines.push(`type: ${stub.kind}`);
  lines.push("source: Remarkabler");
  lines.push(`mentions: ${dayCount}`);
  lines.push(`exported: ${exportedAt || "unknown"}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${stub.name}`);
  lines.push("");
  lines.push(
    dayCount > 0
      ? `_${stub.kind} · appears on ${dayCount} day${dayCount === 1 ? "" : "s"} in your diary._`
      : `_${stub.kind} · mentioned only in conversations so far._`
  );
  lines.push("");
  // Claude-written profile (the "wiki" body), when one has been generated.
  const summary = (stub.summary || "").trim();
  if (summary) {
    lines.push(summary);
    lines.push("");
  }
  // The librarian's own notes — a separate section so it's visually and
  // structurally distinct from the diary-written summary above.
  const conversationNotes = (stub.conversationNotes || "").trim();
  if (conversationNotes) {
    lines.push("## Recent conversations");
    lines.push("");
    lines.push(conversationNotes);
    lines.push("");
  }
  // Direct backlinks to every tagged conversation/reflection note — the
  // reverse of that note's own "## Connects to" section, so either side of
  // the link is a real clickable Obsidian graph edge, not just a derived
  // ranking inside the app's own /mind or chat tools.
  if (stub.relatedNoteLinks && stub.relatedNoteLinks.length > 0) {
    lines.push("## Conversations & reflections");
    lines.push("");
    for (const link of stub.relatedNoteLinks) lines.push(`- [[${link}]]`);
    lines.push("");
  }
  if (dayCount > 0) {
    lines.push("## Mentions");
    lines.push("");
    for (const d of stub.dates) lines.push(`- [[${d}]]`);
    if (stub.undated) lines.push(`- [[undated]]`);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Build { filename → Markdown } for the entity stub notes. `stubs` should
 * already carry canonical, sanitized names (one per real-world entity).
 */
export function buildEntityStubFiles(opts: {
  stubs: EntityStub[];
  exportedAt: string;
}): Map<string, string> {
  const files = new Map<string, string>();
  for (const stub of opts.stubs) {
    files.set(
      entityStubFileName(stub.kind, stub.name),
      renderEntityStub(stub, opts.exportedAt)
    );
  }
  return files;
}
