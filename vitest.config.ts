import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Workflow tests need the @workflow/vitest plugin (`pnpm test:workflows`);
    // integration tests need the real database (`pnpm test:integration`).
    exclude: [
      ...configDefaults.exclude,
      "**/*.workflow.test.ts",
      "**/*.integration.test.ts",
    ],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
