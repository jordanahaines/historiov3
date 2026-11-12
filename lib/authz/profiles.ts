import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";

export type ProfileRef = { id: string };

/**
 * Resolves a user from the secret in their inbound address. This is the only
 * way the inbound webhook learns who an email belongs to. Tokens are stored
 * lowercase; the lookup is case-insensitive because email local parts aren't
 * reliably case-preserved.
 */
export async function getProfileByInboundToken(
  token: string,
): Promise<ProfileRef | null> {
  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.inboundToken, token.trim().toLowerCase()))
    .limit(1);
  return profile ?? null;
}

/** For CLIs: confirms a profile exists before running work on its behalf. */
export async function getProfileById(id: string): Promise<ProfileRef | null> {
  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1);
  return profile ?? null;
}
