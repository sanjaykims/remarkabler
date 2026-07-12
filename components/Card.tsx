import { cn } from "./cn";

// Bordered surface with the `rounded border border-slate-200 dark:border-slate-800`
// pattern repeated across pages. `as` lets callers render as <article> /
// <section> / <li> instead of the default <div>.
type CardProps = {
  as?: "div" | "section" | "article" | "li";
  className?: string;
  children: React.ReactNode;
};

export function Card({ as = "div", className, children }: CardProps) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        "rounded border border-slate-200 dark:border-slate-800 p-4",
        className
      )}
    >
      {children}
    </Tag>
  );
}
