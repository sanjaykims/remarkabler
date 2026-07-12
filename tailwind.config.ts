import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

// Dark mode is intentionally MEDIA-based (prefers-color-scheme), not class-based.
// Every existing `dark:` variant in the codebase depends on this. Do not switch
// without auditing — see DESIGN.md.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Clear Sans is loaded as a CSS variable in app/layout.tsx via
        // next/font/local. Falls back to system sans if the woff2 fails.
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        // Semantic alias for the accent hue. Use `accent-*` when intent is
        // "decorative accent"; use `sky-*` directly when intent is the specific
        // shade. The palette is Fresh Summer Sky (see DESIGN.md): sky-blue
        // accent + one sunny `amber-400` CTA.
        accent: colors.sky,
      },
    },
  },
  plugins: [],
};

export default config;
