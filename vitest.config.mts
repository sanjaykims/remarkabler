import { defineConfig } from "vitest/config";
import path from "path";

// Unit tests for pure logic only — date parsing, PCA math, JSON parsing, plus
// one DB-backed integration test for the discipline filter. No network.
// Node environment because the code under test is server-side (better-sqlite3
// and the Anthropic SDK live in the import graph but are only touched lazily,
// never at import time).
//
// The `@/` alias is resolved manually rather than via vite-tsconfig-paths,
// which is ESM-only and fails to load inside the CJS-bundled config step.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
