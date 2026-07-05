// Pure entity co-occurrence — the "graph edges" behind the Obsidian graph and
// the related_entities chat tool. Two entities are connected when they're
// mentioned on the same day (the same YYYY-MM-DD day-note links both in
// Obsidian). No DB/IO here; the caller resolves effective dates + canonical
// names and hands in flat memberships.

export type EntityKind = "person" | "place" | "project";

// One (entity, day) membership. `day` is an effective diary date
// ("YYYY-MM-DD"); undated mentions must be excluded by the caller — in
// Obsidian every undated page shares the one `undated` note, so counting it
// would spuriously link everything to everything. `name` is the canonical
// display name (one per kind+norm).
export type DayMembership = {
  day: string;
  kind: EntityKind;
  norm: string;
  name: string;
};

export type RelatedEntity = {
  name: string;
  kind: EntityKind;
  sharedDays: number;
  days: string[]; // the shared days, sorted
};

// Rank the entities that co-occur with `target` (share ≥1 day), most shared
// days first, then by name for stable ordering. Returns [] if the target
// itself never appears on a dated page.
export function computeRelatedEntities(
  memberships: DayMembership[],
  target: { kind: EntityKind; norm: string },
  limit: number
): RelatedEntity[] {
  const isTarget = (m: { kind: string; norm: string }) =>
    m.kind === target.kind && m.norm === target.norm;

  const targetDays = new Set<string>();
  for (const m of memberships) if (isTarget(m)) targetDays.add(m.day);
  if (targetDays.size === 0) return [];

  const acc = new Map<
    string,
    { kind: EntityKind; name: string; days: Set<string> }
  >();
  for (const m of memberships) {
    if (isTarget(m)) continue;
    if (!targetDays.has(m.day)) continue;
    const key = `${m.kind} ${m.norm}`;
    let a = acc.get(key);
    if (!a) {
      a = { kind: m.kind, name: m.name, days: new Set() };
      acc.set(key, a);
    }
    a.days.add(m.day);
    // Safety net if a caller passed mixed casings for one norm: keep the
    // lexicographically smallest, matching the MIN(name) canonical convention.
    if (m.name < a.name) a.name = m.name;
  }

  const out: RelatedEntity[] = [...acc.values()].map((a) => ({
    name: a.name,
    kind: a.kind,
    sharedDays: a.days.size,
    days: [...a.days].sort(),
  }));
  out.sort(
    (x, y) => y.sharedDays - x.sharedDays || x.name.localeCompare(y.name)
  );
  return out.slice(0, Math.max(1, limit));
}
