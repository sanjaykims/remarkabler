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

const EXCERPT_PAGES = 12; // newest mentioning pages fed to Claude
const EXCERPT_CHARS = 700; // per-page cap; 12×700 stays under the prompt cap
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

// The mentioning pages for one entity, newest first, capped.
function mentions(
  kind: Kind,
  norm: string
): Array<{ page_id: string; date: string | null; text: string }> {
  // ALL mentioning pages, newest first — not capped. The freshness hash is
  // computed over this full set so an edit to any mentioning page (even an
  // old one outside the newest window) flips it; the EXCERPT_PAGES cap is
  // applied later, only to what's sent to Claude (PR #111).
  return db()
    .prepare(
      `SELECT p.id AS page_id, NULLIF(p.entry_date, 'none') AS date, p.ocr_text AS text
       FROM entry_entities e JOIN pages p ON p.id = e.page_id
       WHERE e.kind = ? AND e.name_norm = ? AND p.notebook_id != ?
         AND p.ocr_text IS NOT NULL AND p.ocr_text != ''
       ORDER BY COALESCE(NULLIF(p.entry_date, 'none'), '0000-00-00') DESC,
                p.page_index ASC
       LIMIT ?`
    )
    .all(kind, norm, DISCIPLINE_ID, EXCERPT_PAGES) as Array<{
    page_id: string;
    date: string | null;
    text: string;
  }>;
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
  refreshInFlight = true;
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
  const model = process.env.CHAT_MODEL || "claude-sonnet-5";

  let generated = 0;
  let failed = 0;
  let remaining = 0;
  const entities: Array<{ kind: Kind; name: string }> = [];
  try {
    for (const kind of KINDS) {
      for (const c of candidates(kind)) {
        const rows = mentions(kind, c.norm); // newest EXCERPT_PAGES
        if (rows.length === 0) continue;
        // Build the excerpts (exactly what Claude reads) FIRST, then hash
        // them — so the stored hash matches the profile's actual input.
        const excerpts: EntityWikiExcerpt[] = rows.map((r) => ({
          date: r.date,
          text:
            r.text.length > EXCERPT_CHARS ? r.text.slice(0, EXCERPT_CHARS) : r.text,
        }));
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
    const res = await refreshEntityWiki({ limit: 8 });
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
      void maybeExportDiaryToDropbox({ onlyEntityStubs: stubPaths });
    }
  } catch (e) {
    console.warn("[entityWiki] sweep refresh failed:", (e as Error).message);
  }
}

export function entityWikiAutoEnabled(): boolean {
  return getSetting(AUTO_SETTING) === "1";
}
