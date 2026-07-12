import { cn } from "./cn";

// Small uppercase label preceded by a short sky-blue tick — the "margin rule
// marks where you are" motif from the redesign, scaled down to a section
// label. Server-safe, hook-free. Use above a heading to give it a calm,
// considered eyebrow.
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300",
        className
      )}
    >
      <span aria-hidden className="h-px w-4 bg-current" />
      {children}
    </span>
  );
}
