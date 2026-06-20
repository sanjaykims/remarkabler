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
        // Semantic alias for amber. Use `accent-*` when intent is "decorative
        // warmth"; use `amber-*` directly when intent is the specific shade.
        accent: colors.amber,
      },
    },
  },
  plugins: [],
};

export default config;
