// Bordered section with an H2 title and optional subtitle. Lifted from
// `app/mind/page.tsx` where it was first introduced; same shape, no
// behavior change.
export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <header>
        <h2 className="text-lg font-medium">{title}</h2>
        {subtitle && <p className="text-xs opacity-60">{subtitle}</p>}
      </header>
      <div className="rounded border border-slate-200 dark:border-slate-800 p-3">
        {children}
      </div>
    </section>
  );
}
