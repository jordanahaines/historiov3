import type { db } from "@/lib/db";

/** The handle inside `db.transaction(async (tx) => ...)`. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Either the shared client or a transaction — for queries usable in both. */
export type DbExecutor = typeof db | Tx;
