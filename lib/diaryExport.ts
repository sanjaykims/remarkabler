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
      parts.push(`people: ${entities.person.join(", ")}`);
    if (entities.place.length)
      parts.push(`places: ${entities.place.join(", ")}`);
    if (entities.project.length)
      parts.push(`projects: ${entities.project.join(", ")}`);
  }
  return `_${parts.join(" · ")}_`;
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

  const lines: string[] = [];

  lines.push("---");
  lines.push('title: "My Diary"');
  lines.push("source: Remarkabler");
  lines.push(`exported: ${exportedAt || "unknown"}`);
  lines.push(`pages: ${rows.length}`);
  lines.push(`notebooks: ${notebookCount}`);
  if (firstDate && lastDate) lines.push(`range: ${firstDate} → ${lastDate}`);
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
