import Link from "next/link";
import { cn } from "./cn";

// Button styles used throughout the app. Encapsulates the existing class
// strings — no visual change vs. inline. Six variants:
//   primary   — high-contrast filled amber (the "Add a notebook" button).
//               The one sunny-yellow CTA — see DESIGN.md's "yellow is
//               sacred" rule. Don't reuse amber for anything else.
//   secondary — bordered neutral (the "Chat with your notes" button).
//   ghost     — borderless text button for low-emphasis actions.
//   solid     — high-contrast filled, but slate not amber (Generate
//               insights, Save edits, Sync now, ...) — a primary-feeling
//               action that deliberately isn't the one amber CTA.
//   danger    — bordered red-tinted, for destructive/attention actions
//               (Retry stuck batches).
//   text      — bare underlined trigger, no padding/border feel (plain
//               Delete/Edit/Cancel-style links).
//
// Sizes mirror the existing rhythm (`px-4 py-3` / `px-3 py-2` / the
// smaller `px-3 py-1.5` used by compact inline actions).

type Variant = "primary" | "secondary" | "ghost" | "solid" | "danger" | "text";
type Size = "xs" | "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  // Primary is the one sunny-yellow CTA — the single warm pop in the otherwise
  // sky-blue Fresh Summer palette (see DESIGN.md). Deep-sky text for AA.
  primary:
    "bg-amber-400 text-sky-950 transition-colors hover:bg-amber-300",
  secondary:
    "border border-slate-300 dark:border-slate-700 bg-transparent transition-colors hover:border-sky-400",
  ghost: "bg-transparent",
  solid: "bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900",
  danger:
    "border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 bg-transparent",
  text: "bg-transparent underline opacity-70 transition-opacity hover:opacity-100",
};

const SIZE_CLASSES: Record<Size, string> = {
  xs: "px-3 py-1.5 text-xs",
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-3 text-sm font-medium",
};

const BASE = "rounded inline-flex items-center justify-center text-center disabled:opacity-50";

type Common = {
  variant?: Variant;
  size?: Size;
  className?: string;
};

type ButtonProps = Common &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">;

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={cn(BASE, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className)}
    />
  );
}

type LinkButtonProps = Common & {
  href: string;
  children: React.ReactNode;
  prefetch?: boolean;
};

// Anchor styled as a button (Next Link). Used for the "Add a notebook" /
// "Chat with your notes" actions on the dashboard.
export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  prefetch,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(BASE, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className)}
    >
      {children}
    </Link>
  );
}
