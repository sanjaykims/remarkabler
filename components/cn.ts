// Tiny class-concatenation helper. Falsy values drop out so callers can
// write `cn("base", active && "extra")`. No new dependency; six lines is
// cheaper than pulling in clsx for the same behavior.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
