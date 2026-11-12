import path from "node:path";
import { workflow } from "@workflow/vitest";
import { defineConfig } from "vitest/config";

const workflowsDir = path.resolve(__dirname, "lib/workflows");

// Workflow integration tests: the workflow() plugin compiles "use workflow" /
// "use step" directives and runs workflows in-process against a Local World.
// Kept separate from vitest.config.ts per the Workflow SDK testing guidance.
// Run with `pnpm test:workflows`.
//
// The plugin's bundler is scoped to lib/workflows rather than the repo root.
// Scanning the root picks up this file and next.config.ts, follows their
// imports into the SDK's own builder package, and bakes those internals into
// the step bundle, which then fails to load (workflow 4.8.9). Steps' imports
// outside lib/workflows are still bundled by following them from the steps.
//
// The directive transform derives workflow/step IDs from process.cwd(), so the
// `test:workflows` script runs Vitest from lib/workflows to keep those IDs in
// sync with the bundle's.
export default defineConfig({
  root: __dirname,
  plugins: [workflow({ cwd: workflowsDir, rootDir: __dirname })],
  test: {
    environment: "node",
    include: ["**/*.workflow.test.ts"],
    // The workflow bundle loads the real step modules (and so lib/db), which
    // requires a URL at import time. These tests never query: postgres.js
    // connects lazily.
    env: { DATABASE_URL: "postgres://unused:unused@localhost:6543/unused" },
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
