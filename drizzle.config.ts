import { defineConfig } from "drizzle-kit";
import "dotenv/config";

// Migrations use the direct connection (port 5432), not the pooler.
// The migration journal lives in the v3 schema so this project never touches
// the old app's `drizzle` journal in the same database.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["v3"],
  migrations: { schema: "v3", table: "__drizzle_migrations" },
  dbCredentials: { url: process.env.DATABASE_URL_DIRECT! },
});
