import { createHash } from "crypto";
import { db, getSetting, setSetting } from "./db";
import { DISCIPLINE_ID } from "./notes";
import { composeEntityWiki, type EntityWikiExcerpt } from "./claude";

// The "life wiki": a Claude-written profile per entity (kind, name_norm),
// stored in entity_wiki and embedded atop that entity's Obsidian stub note.
// Regeneration is content-addressed: each profile records a hash of the
// mentioning pages it was written from, so a new/edited entry that mentions
// the entity flips the hash and the profile is rewritten — that's the
// "keep it updated whenever an item changes" mechanism.

const KINDS = ["person", "place", "project"] as const;
type Kind = (typeof KINDS)[number];

// The profile is written from the entity's ENTIRE mention history (not a
// recent slice), in chronological order, so it can capture identity, the arc
// of the relationship, and current status. Cost is bounded by a per-entity
// input budget: an entity mentioned more than fits gets an even chronological
// SAMPLE (always incl. first + last) so the whole timeline is still
// represented.
const PER_PAGE_CHARS = 1500; // per-mention cap sent to Claude
const MAX_INPUT_CHARS = 60000; // ~20K tokens of history per profile
const AUTO_SETTING = "entity_wiki_auto"; // "1" once the user builds the wiki

// One (kind, name_norm) → its canonical display name, discipline excluded.
function candidates(kind: Kind): Array<{ norm: string; name: string }> {
  return db()
    .prepare(
      `SELECT e.name_norm AS norm, MIN(e.name) AS name
       FROM entry_entities e JOIN pages p ON p.id = e.page_id
       WHERE e.kind = ? AND p.notebook_id != ?
       GROUP BY e.name_norm
       ORDER BY COUNT(DISTINCT e.page_id) DESC, name ASC`
    )
    .all(kind, DISCIPLINE_ID) as Array<{ norm: string; name: string }>;
}

// ALL mentioning pages for one entity, in CHRONOLOGICAL order (oldest first,
// undated last), discipline excluded — the entity's whole diary history.
function mentions(
  kind: Kind,
  norm: string
): Array<{ page_id: string; date: string | null; text: string }> {
  return db()
    .prepare(
      `SELECT p.id AS page_id, NULLIF(p.entry_date, 'none') AS date, p.ocr_text AS text
       FROM entry_entities e JOIN pages p ON p.id = e.page_id
       WHERE e.kind = ? AND e.name_norm = ? AND p.notebook_id != ?
         AND p.ocr_text IS NOT NULL AND p.ocr_text != ''
       ORDER BY COALESCE(NULLIF(p.entry_date, 'none'), '9999-99-99') ASC,
                p.page_index ASC`
    )
    .all(kind, norm, DISCIPLINE_ID) as Array<{
    page_id: string;
    date: string | null;
    text: string;
  }>;
}

function excerptsLen(arr: EntityWikiExcerpt[]): number {
  return arr.reduce((n, e) => n + e.text.length, 0);
}

// Evenly spaced indices across [0 .. len-1], always including both ends.
function evenSample<T>(arr: T[], keep: number): T[] {
  if (keep >= arr.length) return arr.slice();
  const step = (arr.length - 1) / (keep - 1);
  const out: T[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < keep; i++) {
    const idx = Math.round(i * step);
    if (!seen.has(idx)) {
      seen.add(idx);
      out.push(arr[idx]);
    }
  }
  return out;
}

// Turn the full chronological mention set into the excerpts sent to Claude:
// each page trimmed to `perPageChars`, and if the total would exceed
// `maxChars`, an even chronological sample (keeping the FIRST and LAST) so the
// whole arc is represented. The returned set's ACTUAL total is guaranteed
// ≤ maxChars — the keep count is derived from the average but then verified
// against the real selected sizes and reduced until it fits, and as a final
// guard the kept texts are hard-trimmed if even first+last overflow (uneven
// mention lengths could otherwise blow the budget; PR #116). Pure — exported
// for unit testing.
export function selectWikiExcerpts(
  rows: Array<{ date: string | null; text: string }>,
  maxChars = MAX_INPUT_CHARS,
  perPageChars = PER_PAGE_CHARS
): EntityWikiExcerpt[] {
  const capped: EntityWikiExcerpt[] = rows.map((r) => ({
    date: r.date,
    text: r.text.length > perPageChars ? r.text.slice(0, perPageChars) : r.text,
  }));
  if (excerptsLen(capped) <= maxChars) return capped;

  // Over budget: find the largest even sample whose ACTUAL total fits. Start
  // from an average-based estimate, then shrink until the real sum is within
  // budget (never below the two endpoints).
  const avg = Math.max(1, Math.round(excerptsLen(capped) / capped.length));
  let keep = Math.max(2, Math.min(capped.length, Math.floor(maxChars / avg)));
  let sample = evenSample(capped, keep);
  while (keep > 2 && excerptsLen(sample) > maxChars) {
    keep--;
    sample = evenSample(capped, keep);
  }
  // Final guard: if even the endpoints overflow, hard-trim each kept text to
  // an equal share of the budget so the sent input is always ≤ maxChars
  // (keeps hash == prompt input, and the cost cap, honest).
  if (excerptsLen(sample) > maxChars) {
    const per = Math.max(1, Math.floor(maxChars / sample.length));
    sample = sample.map((e) => ({
      date: e.date,
      text: e.text.length > per ? e.text.slice(0, per) : e.text,
    }));
  }
  return sample;
}

// Digest of the EXACT excerpts sent to Claude (date + truncated text), so
// the stored hash and the generated profile always reflect the same input;
// a hash change always means the profile input actually changed (PR #112).
function excerptHash(excerpts: EntityWikiExcerpt[]): string {
  const h = createHash("sha256");
  for (const e of excerpts) h.update(`${e.date ?? ""}\u0000${e.text}\u0001`);
  return h.digest("hex");
}

export function getEntityWikiSummary(
  kind: string,
  norm: string
): string | null {
  try {
    const row = db()
      .prepare(
        `SELECT summary FROM entity_wiki WHERE kind = ? AND name_norm = ?`
      )
      .get(kind, norm) as { summary: string } | undefined;
    return row?.summary ?? null;
  } catch {
    return null;
  }
}

// All stored profiles (one query) for the export to attach to stubs. Returns
// the canonical `name` too so the caller can key by the same sanitized
// display name the stub filename uses.
export function allEntityWikiRows(): Array<{
  kind: string;
  name_norm: string;
  name: string;
  summary: string;
}> {
  try {
    return db()
      .prepare(`SELECT kind, name_norm, name, summary FROM entity_wiki`)
      .all() as Array<{
      kind: string;
      name_norm: string;
      name: string;
      summary: string;
    }>;
  } catch {
    return []; // table missing — export just renders the skeletal stubs
  }
}

let refreshInFlight = false;

/**
 * Generate/refresh entity profiles. Scans every entity (all kinds), skipping
 * those whose stored profile still matches their current source hash, and
 * spends Claude on up to `limit` stale ones. Serial + in-flight guarded (like
 * analyzePending). Returns how many it wrote and how many stale entities it
 * didn't get to this pass.
 */
export async function refreshEntityWiki(
  opts?: { limit?: number }
): Promise<{
  generated: number;
  failed: number;
  remaining: number;
  entities: Array<{ kind: Kind; name: string }>;
  skipped?: "in-flight";
}> {
  const limit = Math.max(1, Math.min(400, opts?.limit ?? 40));
  if (refreshInFlight)
    return { generated: 0, failed: 0, remaining: 0, entities: [], skipped: "in-flight" };

  const model = process.env.CHAT_MODEL || "claude-sonnet-5";
  let generated = 0;
  let failed = 0;
  let remaining = 0;
  const entities: Array<{ kind: Kind; name: string }> = [];
  // Set the in-flight flag as the LAST thing before the try, so a throw in
  // the setup below (setSetting / db().prepare — synchronous DB writes that
  // can raise SQLITE_BUSY etc.) can't leave the flag stuck true and silently
  // disable every future refresh until the process restarts.
  refreshInFlight = true;
  try {
    // Tapping "build" opts this diary into ongoing auto-refresh in the sweep.
    setSetting(AUTO_SETTING, "1");

    const upsert = db().prepare(
      `INSERT INTO entity_wiki(kind, name_norm, name, summary, source_hash, model, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(kind, name_norm) DO UPDATE SET
         name = excluded.name, summary = excluded.summary,
         source_hash = excluded.source_hash, model = excluded.model,
         updated_at = excluded.updated_at`
    );
    for (const kind of KINDS) {
      for (const c of candidates(kind)) {
        const rows = mentions(kind, c.norm); // whole history, chronological
        if (rows.length === 0) continue;
        // Select the excerpts (exactly what Claude reads — the full history,
        // sampled only if over budget) FIRST, then hash them, so the stored
        // hash matches the profile's actual input.
        const excerpts = selectWikiExcerpts(rows);
        const hash = excerptHash(excerpts);
        const existing = db()
          .prepare(
            `SELECT source_hash FROM entity_wiki WHERE kind = ? AND name_norm = ?`
          )
          .get(kind, c.norm) as { source_hash: string } | undefined;
        if (existing && existing.source_hash === hash) continue; // fresh
        if (generated >= limit) {
          remaining++; // stale but over this pass's budget
          continue;
        }
        let summary: string | null = null;
        try {
          summary = await composeEntityWiki(kind, c.name, excerpts);
        } catch (e) {
          console.warn(`[entityWiki] compose ${kind}/${c.name} failed:`, (e as Error).message);
          failed++;
          continue;
        }
        if (!summary) continue;
        try {
          upsert.run(kind, c.norm, c.name, summary, hash, model);
          generated++;
          entities.push({ kind, name: c.name });
        } catch (e) {
          console.warn(`[entityWiki] upsert ${kind}/${c.name} failed:`, (e as Error).message);
          failed++;
        }
      }
    }
  } finally {
    refreshInFlight = false;
  }
  return { generated, failed, remaining, entities };
}

// Sweep hook: keep profiles fresh as new entries arrive, but only once the
// user has opted in (built the wiki at least once) and only a few per sweep
// so it can't run up cost. Best-effort; never throws.
export async function maybeRefreshEntityWiki(): Promise<void> {
  if (getSetting(AUTO_SETTING) !== "1") return;
  if (!process.env.ANTHROPIC_API_KEY) return;
  try {
    const res = await refreshEntityWiki({ limit: 4 });
    // The ingest export already ran (with the OLD profile bodies) before this
    // sweep regenerated them, so push the refreshed profiles to Dropbox now —
    // otherwise new summaries stay in SQLite until a manual export (the review
    // #111). Upload ONLY the regenerated stub files, not the whole vault: a
    // full re-sync would rewrite every day file + stub and hog the write
    // quota / in-flight guard just to push a few profiles (PR #112).
    if (res.entities.length > 0) {
      const [{ maybeExportDiaryToDropbox }, { entityStubRelPathForName }] =
        await Promise.all([import("./dropbox"), import("./diaryExportDb")]);
      const stubPaths = res.entities.map((e) =>
        entityStubRelPathForName(e.kind, e.name)
      );
      // .catch() is load-bearing, not decoration: a bare `void promise` with
      // no handler becomes an unhandled rejection if this ever throws past
      // its own internal fail-open guards, which (depending on Node's
      // unhandled-rejection policy) can crash the whole server process.
      void maybeExportDiaryToDropbox({ onlyEntityStubs: stubPaths }).catch(
        (e) => console.warn("[entityWiki] stub export failed:", (e as Error).message)
      );
    }
  } catch (e) {
    console.warn("[entityWiki] sweep refresh failed:", (e as Error).message);
  }
}

export function entityWikiAutoEnabled(): boolean {
  return getSetting(AUTO_SETTING) === "1";
}
