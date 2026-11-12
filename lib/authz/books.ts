import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { books, userBooks } from "@/lib/db/schema";

export type Book = typeof books.$inferSelect;

export type FindOrCreateBookByAsinInput = {
  asin: string;
  title: string;
  author: string | null;
  /** Only used when the book is new; never overwrites an existing cover. */
  coverImageUrl?: string;
};

export type FindOrCreateBookByAsinResult = { book: Book; created: boolean };

export async function getBookById(bookId: string): Promise<Book | null> {
  const [book] = await db
    .select()
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);
  return book ?? null;
}

/**
 * Matches the shared catalog by ASIN, creating the book if it's new. Safe
 * under concurrent calls: the unique ASIN makes the loser's insert a no-op and
 * it reads the winner's row.
 */
export async function findOrCreateBookByAsin(
  input: FindOrCreateBookByAsinInput,
): Promise<FindOrCreateBookByAsinResult> {
  const [inserted] = await db
    .insert(books)
    .values({
      asin: input.asin,
      title: input.title,
      author: input.author,
      coverImageUrl: input.coverImageUrl,
    })
    .onConflictDoNothing({ target: books.asin })
    .returning();
  if (inserted) return { book: inserted, created: true };

  const [existing] = await db
    .select()
    .from(books)
    .where(eq(books.asin, input.asin))
    .limit(1);
  if (!existing) throw new Error(`Book with ASIN ${input.asin} vanished`);
  return { book: existing, created: false };
}

/**
 * Puts a book in a user's library. Importing a book the user had removed
 * (status `removed`) brings it back: they just sent us its highlights.
 */
export async function ensureUserBook(
  userId: string,
  bookId: string,
): Promise<void> {
  await db
    .insert(userBooks)
    .values({ userId, bookId })
    .onConflictDoUpdate({
      target: [userBooks.userId, userBooks.bookId],
      set: { status: "active" },
    });
}

/** Whether the user has this book in their active library. */
export async function userHasActiveBook(
  userId: string,
  bookId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: userBooks.id })
    .from(userBooks)
    .where(
      and(
        eq(userBooks.userId, userId),
        eq(userBooks.bookId, bookId),
        eq(userBooks.status, "active"),
      ),
    )
    .limit(1);
  return Boolean(row);
}
