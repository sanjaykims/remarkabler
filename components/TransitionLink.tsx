"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// A drop-in for next/link that runs the client navigation inside
// document.startViewTransition() so pages cross-fade/glide into one another
// (styled in globals.css via ::view-transition-*). Degrades cleanly:
//   - reduced-motion users OR browsers without the View Transitions API →
//     we don't intercept, so Link navigates instantly as normal.
//   - modified clicks (new tab, middle-click), external URLs, and
//     target=_blank are left entirely to the browser/Link.
// This is what makes navigating between pages feel like one continuous
// surface rather than a hard swap.
type Props = React.ComponentProps<typeof Link>;

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void) => unknown;
};

export default function TransitionLink({ href, onClick, ...rest }: Props) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented) return;
    // Only plain left-clicks in the same tab.
    if (
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      rest.target === "_blank"
    ) {
      return;
    }
    const url = typeof href === "string" ? href : String(href);
    // Only in-app paths — never external / protocol-relative URLs.
    if (!url.startsWith("/") || url.startsWith("//")) return;

    const doc = document as DocWithVT;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof doc.startViewTransition !== "function") return; // let Link handle it

    e.preventDefault();
    doc.startViewTransition(() => router.push(url));
  }

  return <Link href={href} onClick={handleClick} {...rest} />;
}
