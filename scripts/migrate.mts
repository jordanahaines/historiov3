/**
 * Applies ./drizzle migrations to the v3 schema using drizzle's programmatic
 * migrator. Used instead of `drizzle-kit migrate`, which exits quietly without
 * applying anything (and hides the underlying error) in this setup.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL_DIRECT;
  if (!url) throw new Error("DATABASE_URL_DIRECT is not set");
  const client = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: "./drizzle",
      migrationsSchema: "v3",
      migrationsTable: "__drizzle_migrations",
    });
    console.log("Migrations applied.");
  } finally {
    await client.end();
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
