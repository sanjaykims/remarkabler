import { cn } from "./cn";

// Small pill label. `neutral` matches the existing chat-memory category
// chip; `accent` is amber for emphasis.
type BadgeProps = {
  tone?: "neutral" | "accent";
  className?: string;
  children: React.ReactNode;
};

const TONE_CLASSES = {
  neutral:
    "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  accent:
    "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400",
} as const;

export function Badge({ tone = "neutral", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
