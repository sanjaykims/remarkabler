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
    "bg-stone-100 text-stone-700 dark:bg-stone-900 dark:text-stone-300",
  accent:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
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
