// Pure Markdown assembly for the diary export (app/api/export/diary).
// Kept out of the route handler so the grouping / ordering / rendering
// logic is unit-testable without spinning up Next — the same pattern as
// lib/chatMemoryBackfill.ts. No DB, no I/O here; the route fetches rows
// and hands them in.

export type DiaryPageRow = {
  id: string;
  entry_date: string | null;
  page_index: number;
  ocr_text: string;
  notebook_name: string;
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
 * `rows` MUST already be ordered by the route: dated pages first (oldest →
 * newest by entry_date, then notebook, then page_index), undated pages
 * last. This function does run-length grouping on that order, so it does
 * not re-sort — keeping it a pure, order-preserving transform.
 */
export function buildDiaryMarkdown(opts: {
  rows: DiaryPageRow[];
  entitiesByPage: Map<string, PageEntities>;
  exportedAt: string;
}): string {
  const { rows, entitiesByPage, exportedAt } = opts;

  const dated = rows.filter((r) => isDatedEntry(r.entry_date));
  const undated = rows.filter((r) => !isDatedEntry(r.entry_date));

  const dates = dated.map((r) => r.entry_date as string);
  const firstDate = dates.length ? dates[0] : "";
  const lastDate = dates.length ? dates[dates.length - 1] : "";
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

  let currentDate = "";
  for (const r of dated) {
    const d = r.entry_date as string;
    if (d !== currentDate) {
      lines.push("---");
      lines.push("");
      lines.push(`## ${d}`);
      lines.push("");
      currentDate = d;
    }
    lines.push(pageMetaLine(r, entitiesByPage.get(r.id)));
    lines.push("");
    lines.push(r.ocr_text.trim());
    lines.push("");
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
