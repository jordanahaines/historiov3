import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is not set. It must be Supabase's transaction-mode pooler (port 6543).",
  );
}

// Next dev HMR re-evaluates this module on every reload; cache the client on
// globalThis so reloads reuse one pool instead of leaking connections.
const globalForDb = globalThis as unknown as {
  __historioPgClient?: ReturnType<typeof postgres>;
};

// `prepare: false` is required — Supavisor's transaction mode doesn't support
// prepared statements. `max` is kept small because every serverless instance
// opens its own pool against the pooler's connection limit.
const client =
  globalForDb.__historioPgClient ?? postgres(url, { prepare: false, max: 5 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__historioPgClient = client;
}

export const db = drizzle(client, { schema });
