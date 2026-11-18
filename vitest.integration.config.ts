import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests run against the real Supabase `v3` schema. Each test
// creates its own auth user (the profile trigger makes the profile) and
// deletes it afterwards. Needs DATABASE_URL (loaded from .env by the tests).
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
