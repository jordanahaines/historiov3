import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// DATABASE_URL must point at Supabase's transaction-mode pooler (port 6543).
// `prepare: false` is required there — Supavisor's transaction mode doesn't
// support prepared statements.
const client = postgres(process.env.DATABASE_URL!, { prepare: false });

export const db = drizzle(client, { schema });
