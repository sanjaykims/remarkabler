"use client";

import { useEffect, useRef, useState } from "react";

// Centered "big number + label" card. De-duplicates the inline copies in
// `app/page.tsx` and `app/usage/page.tsx`. `tabular-nums` keeps the digits
// monospaced while they change.
//
// Numeric values count up from 0 on first view (redesign phase 2) — a small,
// calm delight. Pure enhancement: the SERVER renders the final value, so
// no-JS, reduced-motion, and the pre-hydration paint all show the real number;
// only a JS-capable client animates it. String values (e.g. money like
// "$6.52" on Cost) are shown as-is.
export function Stat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  const isNum = typeof value === "number";
  const finalStr = isNum
    ? (value as number).toLocaleString("en-US")
    : String(value);
  const [display, setDisplay] = useState(finalStr);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNum) {
      setDisplay(finalStr);
      return;
    }
    const target = value as number;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || target === 0) {
      setDisplay(target.toLocaleString("en-US"));
      return;
    }

    let raf = 0;
    let done = false;
    const animate = () => {
      if (done) return;
      done = true;
      const dur = 900;
      let start: number | null = null;
      const frame = (t: number) => {
        if (start === null) start = t;
        const p = Math.min((t - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        setDisplay(Math.round(target * eased).toLocaleString("en-US"));
        if (p < 1) raf = requestAnimationFrame(frame);
        else setDisplay(target.toLocaleString("en-US"));
      };
      setDisplay("0");
      raf = requestAnimationFrame(frame);
    };

    const el = ref.current;
    if (el && "IntersectionObserver" in window) {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              animate();
              obs.disconnect();
            }
          });
        },
        { threshold: 0.5 }
      );
      obs.observe(el);
      return () => {
        obs.disconnect();
        cancelAnimationFrame(raf);
      };
    }
    animate();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div
      ref={ref}
      className="rounded border border-slate-200 dark:border-slate-800 p-3 text-center"
    >
      <div className="text-2xl font-semibold tabular-nums">{display}</div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  );
}
