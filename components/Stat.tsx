// Centered "big number + label" card. De-duplicates the inline copies in
// `app/page.tsx` and `app/usage/page.tsx`. `tabular-nums` keeps the
// digits monospaced when values change.
export function Stat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded border border-stone-200 dark:border-stone-800 p-3 text-center">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  );
}
