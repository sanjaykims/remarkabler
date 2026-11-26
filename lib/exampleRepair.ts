import { db } from "./db";
import { anchorPhrase } from "./ocrFlags";
import {
  LOCATOR_VERSION,
  cropPng,
  examplesAvailable,
  type Box,
} from "./handwritingExamples";

// One-time, automatic repair of saved handwriting pictures (`ocr_examples`) cut by the old line
// locator. Before LOCATOR_VERSION 2, a page whose ink-band count happened to equal its line count
// was paired line-by-line even when a split title and a faint line had shifted everything by one,
// so the saved crop could show the line ABOVE the confirmed word. Those pictures are labelled with
// the right text, which makes them misleading examples for the transcriber.
//
// Safety rules (do not weaken):
// - Fail-open and best-effort: nothing here may throw into the sweep or touch page text, flags,
//   learned corrections or any table other than the one picture/version of an example row.
// - An old picture is replaced ONLY by a successfully re-cut one. If the card, the PDF, the
//   renderer or a confident position is missing, the old picture stays and the row is marked done
//   so it is not retried forever.
// - Bounded per sweep and single-flight, like the other maintenance jobs.

export const REPAIR_BATCH = 10;

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

export type RepairFlag = {
  phrase: string;
  /** what the owner confirmed (kept cards store the phrase itself) */
  resolved_text: string | null;
  start_offset: number;
  box: string | null;
  page_id: string;
  page_index: number;
  /** the page's CURRENT text (answers have already been applied to it) */
  ocr_text: string | null;
};

/** Pure: the answered card that produced this saved example, matched the way captureExample
 *  stored it (text = confirmed word, wrong = what it was first read as, or null when the same). */
export function flagForExample(
  ex: { text: string; wrong: string | null },
  flags: RepairFlag[]
): RepairFlag | undefined {
  return flags.find((f) => {
    const confirmed = norm(f.resolved_text ?? f.phrase);
    const wrong = f.phrase !== confirmed ? f.phrase : null;
    return confirmed === ex.text && wrong === ex.wrong;
  });
}

function parseBox(raw: string | null): Box | null {
  try {
    const b = raw ? JSON.parse(raw) : null;
    return Array.isArray(b) && b.length === 4 ? (b as Box) : null;
  } catch {
    return null;
  }
}

let inFlight = false;

type Row = { id: string; text: string; wrong: string | null; notebook_id: string };

/** Re-cut a few saved pictures made by an older locator. Resolves with counts; never throws. */
export async function maybeRepairExamples(): Promise<{ checked: number; replaced: number }> {
  const none = { checked: 0, replaced: 0 };
  if (inFlight) return none;
  try {
    if (!examplesAvailable()) return none; // needs the Docker image's renderer
    inFlight = true;
    const d = db();
    const rows = d
      .prepare(
        `SELECT id, text, wrong, notebook_id FROM ocr_examples
          WHERE locator_v < ? ORDER BY created_at, rowid LIMIT ?`
      )
      .all(LOCATOR_VERSION, REPAIR_BATCH) as Row[];
    let replaced = 0;
    for (const row of rows) {
      try {
        const flags = d
          .prepare(
            `SELECT f.phrase, f.resolved_text, f.start_offset, f.box, f.page_id, f.page_index, p.ocr_text
               FROM ocr_flags f JOIN pages p ON p.id = f.page_id
              WHERE f.notebook_id = ? AND f.status IN ('resolved','kept')
              ORDER BY f.resolved_at, f.rowid`
          )
          .all(row.notebook_id) as RepairFlag[];
        const f = flagForExample(row, flags);
        const text = f?.ocr_text || "";
        if (f && text) {
          const confirmed = norm(f.resolved_text ?? f.phrase);
          // The answer is already in the page text, so look for the confirmed word near where
          // the card sat (later answers on the page can have shifted it by a few characters).
          const at = anchorPhrase(text, confirmed, f.start_offset);
          if (at !== -1) {
            const png = await cropPng(
              row.notebook_id,
              f.page_index,
              parseBox(f.box),
              false,
              { text, offset: at, len: confirmed.length },
              f.page_id
            );
            if (png) {
              d.prepare(`UPDATE ocr_examples SET png = ?, locator_v = ? WHERE id = ?`).run(
                png,
                LOCATOR_VERSION,
                row.id
              );
              replaced++;
              continue;
            }
          }
        }
      } catch (e) {
        console.warn("[exampleRepair] re-cut failed:", (e as Error).message);
      }
      // Could not re-cut: keep the old picture, but do not retry this row on every sweep.
      d.prepare(`UPDATE ocr_examples SET locator_v = ? WHERE id = ?`).run(LOCATOR_VERSION, row.id);
    }
    if (rows.length) {
      console.log(`[exampleRepair] checked ${rows.length} saved pictures, re-cut ${replaced}`);
    }
    return { checked: rows.length, replaced };
  } catch (e) {
    console.warn("[exampleRepair] failed:", (e as Error).message);
    return none;
  } finally {
    inFlight = false;
  }
}
