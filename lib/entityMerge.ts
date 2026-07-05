import { db } from "./db";
import { DISCIPLINE_ID } from "./notes";
import { normaliseEntityName } from "./mind";
import { findEntityDuplicates } from "./claude";

// Entity merging: fold duplicate spellings of one real-world entity (e.g. a
// Korean name and its romanization) into a single canonical (kind,
// name_norm). Because every reader keys on name_norm, the merge is a data
// rewrite — no read-path changes — and an entity_aliases record makes it
// stick for FUTURE ingests (applyEntityAlias on insert).

const KINDS = ["person", "place", "project"] as const;
type Kind = (typeof KINDS)[number];

// Resolve a (kind, norm, name) through the alias table at INSERT time, so a
// later OCR of an already-merged-away spelling folds to the canonical instead
// of resurrecting the duplicate. Returns the input unchanged when not aliased.
export function applyEntityAlias(
  kind: string,
  norm: string,
  name: string
): { norm: string; name: string } {
  try {
    const row = db()
      .prepare(
        `SELECT canonical_norm, canonical_name FROM entity_aliases
         WHERE kind = ? AND alias_norm = ?`
      )
      .get(kind, norm) as
      | { canonical_norm: string; canonical_name: string }
      | undefined;
    if (row) return { norm: row.canonical_norm, name: row.canonical_name };
  } catch {
    // Alias table missing / DB blip — fall back to the raw values.
  }
  return { norm, name };
}

// Merge one alias spelling into a canonical one. Records the alias, repoints
// any existing chain that pointed at the alias, then rewrites the matching
// entry_entities rows. UPDATE OR IGNORE + a cleanup DELETE handles the case
// where a page already carries BOTH spellings (the collided alias row is
// dropped, not duplicated). Returns how many entity rows were rewritten.
export function mergeEntity(
  kind: Kind,
  aliasNorm: string,
  aliasName: string,
  canonicalNorm: string,
  canonicalName: string
): number {
  if (!aliasNorm || !canonicalNorm || aliasNorm === canonicalNorm) return 0;
  let rewritten = 0;
  db().transaction(() => {
    db()
      .prepare(
        `INSERT INTO entity_aliases(kind, alias_norm, alias_name, canonical_norm, canonical_name)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(kind, alias_norm)
         DO UPDATE SET alias_name     = excluded.alias_name,
                       canonical_norm = excluded.canonical_norm,
                       canonical_name = excluded.canonical_name`
      )
      .run(kind, aliasNorm, aliasName || aliasNorm, canonicalNorm, canonicalName);
    // Repoint any prior alias that folded INTO this now-alias spelling, so a
    // chain X→alias→canonical collapses to X→canonical.
    db()
      .prepare(
        `UPDATE entity_aliases SET canonical_norm = ?, canonical_name = ?
         WHERE kind = ? AND canonical_norm = ? AND alias_norm != ?`
      )
      .run(canonicalNorm, canonicalName, kind, aliasNorm, aliasNorm);
    const res = db()
      .prepare(
        `UPDATE OR IGNORE entry_entities SET name_norm = ?, name = ?
         WHERE kind = ? AND name_norm = ?`
      )
      .run(canonicalNorm, canonicalName, kind, aliasNorm);
    rewritten = res.changes;
    // Drop any rows that couldn't be rewritten because the page already had
    // the canonical (UNIQUE(page_id, kind, name_norm) blocked the UPDATE).
    db()
      .prepare(`DELETE FROM entry_entities WHERE kind = ? AND name_norm = ?`)
      .run(kind, aliasNorm);
  })();
  return rewritten;
}

// Every recorded alias, so the merge cleanup can delete the stub note of a
// merged-away entity even if it was merged on an earlier deploy (its
// entry_entities rows are long gone, so dedupeAllEntities won't resurface
// it). Falls back to alias_norm when alias_name is NULL (pre-column rows).
export function listAliases(): Array<{
  kind: Kind;
  alias_norm: string;
  alias_name: string;
}> {
  try {
    const rows = db()
      .prepare(`SELECT kind, alias_norm, alias_name FROM entity_aliases`)
      .all() as Array<{
      kind: Kind;
      alias_norm: string;
      alias_name: string | null;
    }>;
    return rows.map((r) => ({
      kind: r.kind,
      alias_norm: r.alias_norm,
      alias_name: r.alias_name || r.alias_norm,
    }));
  } catch {
    return [];
  }
}

export type MergeReportGroup = {
  kind: Kind;
  canonical: string;
  aliases: string[];
  rewritten: number;
};

// Distinct entity display names for one kind (discipline notebook excluded,
// same as every other entity surface), most-used first so Claude sees the
// prominent names. Uses the MIN(name) canonical convention.
function distinctEntityNames(kind: Kind, limit: number): string[] {
  const rows = db()
    .prepare(
      `SELECT MIN(e.name) AS name
       FROM entry_entities e
       JOIN pages p ON p.id = e.page_id
       WHERE e.kind = ? AND p.notebook_id != ?
       GROUP BY e.name_norm
       ORDER BY COUNT(DISTINCT e.page_id) DESC, name ASC
       LIMIT ?`
    )
    .all(kind, DISCIPLINE_ID, limit) as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

// Scan every kind for duplicate spellings (via Claude) and merge them.
// Best-effort per kind — one kind's Claude/parse failure doesn't abort the
// others. Returns a report of what merged.
export async function dedupeAllEntities(
  opts?: { maxPerKind?: number }
): Promise<{ merged: number; groups: MergeReportGroup[] }> {
  const maxPerKind = Math.min(400, Math.max(10, opts?.maxPerKind ?? 300));
  const groups: MergeReportGroup[] = [];
  let merged = 0;

  for (const kind of KINDS) {
    let names: string[];
    try {
      names = distinctEntityNames(kind, maxPerKind);
    } catch {
      continue;
    }
    if (names.length < 2) continue;

    let found;
    try {
      found = await findEntityDuplicates(kind, names);
    } catch (e) {
      console.warn(`[entityMerge] ${kind} dedup (claude) failed:`, (e as Error).message);
      continue;
    }

    for (const g of found) {
      const canonicalName = g.canonical;
      const canonicalNorm = normaliseEntityName(canonicalName);
      const appliedAliases: string[] = [];
      let rewritten = 0;
      for (const aliasName of g.aliases) {
        const aliasNorm = normaliseEntityName(aliasName);
        if (!aliasNorm || aliasNorm === canonicalNorm) continue;
        try {
          rewritten += mergeEntity(
            kind,
            aliasNorm,
            aliasName,
            canonicalNorm,
            canonicalName
          );
          appliedAliases.push(aliasName);
        } catch (e) {
          console.warn(
            `[entityMerge] merge ${aliasName}→${canonicalName} failed:`,
            (e as Error).message
          );
        }
      }
      if (appliedAliases.length > 0) {
        merged += appliedAliases.length;
        groups.push({ kind, canonical: canonicalName, aliases: appliedAliases, rewritten });
      }
    }
  }

  return { merged, groups };
}
