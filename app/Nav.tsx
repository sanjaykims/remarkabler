"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/cn";

// Routes are listed in nav order. The first entry is the wordmark
// (slightly larger + bold); the rest are nav links with an amber
// underline on active. A transparent border on inactive items keeps the
// row from shifting when active changes.
const LINKS = [
  { href: "/notebooks", label: "Notebooks" },
  { href: "/chat", label: "Chat" },
  { href: "/mind", label: "Mind" },
  { href: "/insights", label: "Insights" },
  { href: "/memory", label: "Memory" },
  { href: "/usage", label: "Cost" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-x-3 text-xs whitespace-nowrap overflow-x-auto">
      <Link
        href="/"
        className={cn(
          "text-base font-semibold tracking-tight border-b-2 mr-1",
          pathname === "/"
            ? "border-amber-600 dark:border-amber-500"
            : "border-transparent"
        )}
      >
        Remarkabler
      </Link>
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "border-b-2 pb-0.5 transition-opacity",
              active
                ? "opacity-100 border-amber-600 dark:border-amber-500"
                : "opacity-70 hover:opacity-100 border-transparent"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
