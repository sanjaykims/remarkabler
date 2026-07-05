// Pure duplicate-notebook classification (app/api/notebooks/duplicates via
// lib/notebookDedupDb.ts). No DB, no I/O here — same split as
// lib/diaryExport.ts / lib/diaryExportDb.ts.
//
// "Old" notebooks (Dropbox-ingested or manually uploaded, i.e. anything
// without a remarkable_doc_id) can end up covering the same diary dates as a
// notebook later imported/synced from the reMarkable cloud. This flags those
// so the user can manually review and delete the redundant copy — never
// automatic.

export type DuplicateClassification = "full" | "partial" | "none";

// "full": every date the old notebook covers is also covered by some cloud
// notebook. "partial": some but not all. "none": zero overlap — not a real
// candidate, callers should skip it.
export function classifyDuplicate(
  oldDates: string[],
  coveredByCloud: Set<string>
): DuplicateClassification {
  if (oldDates.length === 0) return "none";
  const covered = oldDates.filter((d) => coveredByCloud.has(d)).length;
  if (covered === 0) return "none";
  return covered === oldDates.length ? "full" : "partial";
}

export type CloudCoverage = {
  coveredDates: Set<string>;
  coveringByDate: Map<string, Array<{ id: string; name: string }>>;
};

// Union of dates across all cloud notebooks, plus which cloud notebook(s)
// cover each date (so a candidate can show "covered by: X, Y").
export function buildCloudCoverage(
  cloudNotebooks: Array<{ id: string; name: string; dates: string[] }>
): CloudCoverage {
  const coveredDates = new Set<string>();
  const coveringByDate = new Map<string, Array<{ id: string; name: string }>>();
  for (const nb of cloudNotebooks) {
    for (const d of nb.dates) {
      coveredDates.add(d);
      const list = coveringByDate.get(d);
      if (list) list.push({ id: nb.id, name: nb.name });
      else coveringByDate.set(d, [{ id: nb.id, name: nb.name }]);
    }
  }
  return { coveredDates, coveringByDate };
}

export type DuplicateCandidate = {
  id: string;
  name: string;
  pageCount: number; // transcribed pages, not the raw page_count shown on /notebooks
  dates: string[];
  classification: "full" | "partial";
  coveringNotebooks: Array<{ id: string; name: string }>;
  uncoveredDates: string[]; // empty for "full"; the at-risk dates for "partial"
};

// Returns null when the old notebook has no meaningful overlap with any
// cloud notebook (classification "none") — not a candidate at all.
export function buildCandidate(
  old: { id: string; name: string; pageCount: number; dates: string[] },
  coverage: CloudCoverage
): DuplicateCandidate | null {
  const classification = classifyDuplicate(old.dates, coverage.coveredDates);
  if (classification === "none") return null;

  const uncoveredDates = old.dates
    .filter((d) => !coverage.coveredDates.has(d))
    .sort();

  const coveringIds = new Set<string>();
  const coveringNotebooks: Array<{ id: string; name: string }> = [];
  for (const d of old.dates) {
    for (const nb of coverage.coveringByDate.get(d) ?? []) {
      if (coveringIds.has(nb.id)) continue;
      coveringIds.add(nb.id);
      coveringNotebooks.push(nb);
    }
  }

  return {
    id: old.id,
    name: old.name,
    pageCount: old.pageCount,
    dates: [...old.dates].sort(),
    classification,
    coveringNotebooks,
    uncoveredDates,
  };
}
