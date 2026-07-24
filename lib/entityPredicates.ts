// Stored relationship predicate -> human-readable label for rendered notes.
// Keep this pure so the Markdown renderer can use it without importing the
// DB-backed relationship data layer.
const PREDICATE_LABELS = {
  friend_of: "friend of",
  family_of: "family of",
  colleague_of: "colleague of",
  works_at: "works at",
  studied_at: "studied at",
  lives_in: "lives in",
  located_in: "located in",
  part_of: "part of",
  related_to: "related to",
} as const;

export type EntityPredicate = keyof typeof PREDICATE_LABELS;

export const PREDICATES: Readonly<Record<string, string>> = PREDICATE_LABELS;

export function isEntityPredicate(value: string): value is EntityPredicate {
  return Object.prototype.hasOwnProperty.call(PREDICATES, value);
}
