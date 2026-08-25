import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    // These React Compiler advisory rules are new in the Next 16 preset. The
    // existing client views intentionally hydrate browser-only state and use
    // one local render helper; migrate those patterns separately from this
    // security upgrade.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
    },
  },
  // Mirrors tsconfig.json's excludes. `eslint .` walks the whole repo (unlike
  // the old `next lint`, which only saw Next's default dirs), so without this
  // it lints vendored reference projects and generated Graphify output — third
  // party code this repo does not own, which could fail CI on rules we cannot
  // fix.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "docs/reference/**",
    "graphify-out/**",
  ]),
]);
