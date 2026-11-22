/**
 * Helpers for integration tests against the real Supabase `v3` schema. Each
 * test makes its own auth user (the signup trigger creates the profile) and
 * deletes it afterwards; deletion cascades through profiles to everything the
 * user owns. Never imported by app code.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { books, profiles } from "@/lib/db/schema";

export async function createTestUser(): Promise<string> {
  const id = randomUUID();
  await db.execute(
    sql`insert into auth.users (id, email) values (${id}, ${`test-${id}@example.test`})`,
  );
  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, id));
  if (!profile) throw new Error("Signup trigger did not create a v3 profile");
  return id;
}

export async function deleteTestUsers(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.execute(
    sql`delete from auth.users where id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})`,
  );
}

export async function deleteTestBooksByAsin(asins: string[]): Promise<void> {
  if (asins.length === 0) return;
  await db.delete(books).where(inArray(books.asin, asins));
}

import { ensureUserBook } from "@/lib/authz/books";
import { createHighlights } from "@/lib/authz/highlights";

/** Creates a book, puts it in the user's library, and adds one pending highlight. */
export async function createTestHighlight(
  userId: string,
  opts: { asin: string; text?: string },
): Promise<{ bookId: string; highlightId: string }> {
  const [book] = await db
    .insert(books)
    .values({ asin: opts.asin, title: `Book ${opts.asin}`, author: "Test" })
    .onConflictDoUpdate({
      target: books.asin,
      set: { title: `Book ${opts.asin}` },
    })
    .returning({ id: books.id });
  await ensureUserBook(userId, book.id);
  const [highlight] = await createHighlights([
    {
      userId,
      bookId: book.id,
      ingestionEventId: null,
      source: "kindle_scribe",
      externalId: `ext-${randomUUID()}`,
      page: 1,
      chapter: null,
      highlightedText: opts.text ?? "A test highlight",
      noteText: null,
      noteOrigin: null,
      noteImagePath: null,
      annotatedAt: null,
    },
  ]);
  return { bookId: book.id, highlightId: highlight.id };
}
