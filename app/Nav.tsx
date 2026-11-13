"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/components/cn";
import TransitionLink from "@/components/TransitionLink";
import LockAllButton from "./LockAllButton";

// Routes are listed in nav order. The first entry is the wordmark
// (slightly larger + bold); the rest are nav links with a sky-blue
// underline on active. A transparent border on inactive items keeps the
// row from shifting when active changes. Links use TransitionLink so
// navigating between pages cross-fades (View Transitions) instead of
// snapping.
//
// Every item must be visible at once on a phone — no sideways scrolling.
// On small screens the wordmark takes its own line (basis-full) and ALL the
// links plus "Lock all" sit together in ONE row below it: the gap is tightened
// to gap-x-1.5 (6px) because at 360px wide the seven links + Lock all need
// ~270px of the ~328px available, and the old 12px gap pushed Lock all onto a
// third line. They still wrap as a fallback on an even narrower screen. From
// `sm` up it is the original single row with the original 12px gap.
//
// The link text scales with the screen (clamp(11px, 3.2vw, 13px)) so the row
// is as large as will fit on any phone, and `justify-between` spreads the
// items evenly so the row runs edge to edge instead of leaving a gap on the
// right. 3.2vw was sized so text + the 6px minimum gaps still fit at ~360px
// and up; on `sm` and wider it reverts to text-xs and left-aligned.
const LINKS = [
  { href: "/notebooks", label: "Notebooks" },
  { href: "/mind", label: "Mind" },
  { href: "/graph", label: "Graph" },
  { href: "/map", label: "Map" },
  { href: "/insights", label: "Insights" },
  { href: "/memory", label: "Memory" },
  { href: "/usage", label: "Cost" },
];

export default function Nav({ showLockAll = false }: { showLockAll?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center justify-between sm:justify-start gap-x-1.5 sm:gap-x-3 gap-y-1.5 text-[length:clamp(11px,3.2vw,13px)] sm:text-xs whitespace-nowrap">
      <TransitionLink
        href="/"
        aria-current={pathname === "/" ? "page" : undefined}
        className={cn(
          "text-base font-semibold tracking-tight border-b-2 mr-1 basis-full sm:basis-auto",
          pathname === "/"
            ? "border-sky-600 dark:border-sky-500"
            : "border-transparent"
        )}
      >
        Remarkabler
      </TransitionLink>
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <TransitionLink
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 pb-0.5 transition-opacity",
              active
                ? "opacity-100 border-sky-600 dark:border-sky-500"
                : "opacity-70 hover:opacity-100 border-transparent"
            )}
          >
            {link.label}
          </TransitionLink>
        );
      })}
      {showLockAll && <LockAllButton />}
    </nav>
  );
}
