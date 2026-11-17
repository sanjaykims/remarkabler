import { db } from "./db";
import { coachWriting } from "./claude";

// Writing coach. Runs by itself from the maintenance sweep: when recent diary pages are
// transcribed and none of their "Needs your eye" cards are still waiting, Claude reads them
// as personal essays and gives craft feedback (lib/claude.ts coachWriting). One session
// covers the whole batch, and the next session checks the exercise the last one set.
// Never throws; a failed call leaves the pages uncovered so a later sweep retries.

export const RECENT_DAYS = 14;
export const MIN_PAGE_CHARS = 300;
export const MIN_BATCH_CHARS = 600;
export const MAX_BATCH_CHARS = 14_000;
const RETRY_MS = 30 * 60 * 1000;
// Not the owner's handwriting-era prose: synced habit data, exported chats, Claude's own
// reflections and decisions, and the diary composed by talking to Claude.
const SKIP = ["github-discipline", "mcp-conversations", "mcp-reflections", "mcp-decisions", "chat-diary"];

type Row = { id: string; text: string; day: string };

/** Recent, uncoached pages with enough text and no waiting cards, oldest first. */
export function coachablePages(): Row[] {
  return db()
    .prepare(
      `SELECT p.id, p.ocr_text AS text,
              CASE WHEN p.entry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'
                   THEN substr(p.entry_date, 1, 10) ELSE substr(n.synced_at, 1, 10) END AS day
         FROM pages p JOIN notebooks n ON n.id = p.notebook_id
        WHERE n.status = 'done' AND n.id NOT IN (${SKIP.map(() => "?").join(",")})
          AND LENGTH(TRIM(COALESCE(p.ocr_text, ''))) >= ?
          AND NOT EXISTS (SELECT 1 FROM writing_coach_pages c WHERE c.page_id = p.id)
          AND NOT EXISTS (SELECT 1 FROM ocr_flags f WHERE f.page_id = p.id AND f.status = 'pending')
          AND day >= date('now', ?)
        ORDER BY day, p.notebook_id, p.page_index`
    )
    .all(...SKIP, MIN_PAGE_CHARS, `-${RECENT_DAYS} days`) as Row[];
}

/** Newest pages that fit the size budget, returned oldest first. */
export function pickBatch(rows: Row[], max = MAX_BATCH_CHARS): Row[] {
  const out: Row[] = [];
  let used = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const len = rows[i].text.length;
    if (out.length && used + len > max) break;
    out.unshift(rows[i]);
    used += len;
  }
  return out;
}

/** Split Claude's reply into the feedback body and the final exercise line. */
export function splitExercise(raw: string): { feedback: string; exercise: string | null } {
  const i = raw.lastIndexOf("EXERCISE:");
  if (i === -1) return { feedback: raw.trim(), exercise: null };
  const exercise = raw.slice(i + "EXERCISE:".length).trim();
  return { feedback: raw.slice(0, i).trim(), exercise: exercise || null };
}

export type CoachSession = {
  id: number;
  feedback: string;
  exercise: string | null;
  pages: number;
  first_date: string | null;
  last_date: string | null;
  created_at: string;
};

export function listCoachSessions(limit = 30): CoachSession[] {
  return db()
    .prepare(
      `SELECT id, feedback, exercise, pages, first_date, last_date, created_at
         FROM writing_coach ORDER BY id DESC LIMIT ?`
    )
    .all(limit) as CoachSession[];
}

let running = false;
let lastFailAt = 0;

export async function maybeCoachWriting(): Promise<{ ran: boolean; pages?: number }> {
  if (running || Date.now() - lastFailAt < RETRY_MS) return { ran: false };
  running = true;
  try {
    const all = coachablePages();
    if (all.reduce((a, r) => a + r.text.length, 0) < MIN_BATCH_CHARS) return { ran: false };
    const batch = pickBatch(all);
    const last = db().prepare(`SELECT exercise FROM writing_coach ORDER BY id DESC LIMIT 1`).get() as
      | { exercise: string | null }
      | undefined;
    const entries = batch.map((r) => `[${r.day}]\n${r.text}`).join("\n\n---\n\n");
    const raw = await coachWriting({ entries, lastExercise: last?.exercise });
    const { feedback, exercise } = splitExercise(raw);
    if (!feedback) throw new Error("empty feedback");
    db().transaction(() => {
      const id = db()
        .prepare(`INSERT INTO writing_coach(feedback, exercise, pages, first_date, last_date) VALUES(?,?,?,?,?)`)
        .run(feedback, exercise, batch.length, batch[0].day, batch[batch.length - 1].day).lastInsertRowid;
      // Everything eligible is marked, including older pages that didn't fit, so a backlog
      // produces one session rather than a flood.
      const mark = db().prepare(`INSERT OR IGNORE INTO writing_coach_pages(page_id, session_id) VALUES(?,?)`);
      for (const r of all) mark.run(r.id, id);
    })();
    return { ran: true, pages: batch.length };
  } catch (e) {
    lastFailAt = Date.now();
    console.warn("[writingCoach] failed:", (e as Error).message);
    return { ran: false };
  } finally {
    running = false;
  }
}
