import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { parseNotebook } from "historio-kindle-scribe-notes-parser";

vi.mock("@/lib/storage/buckets", () => ({
  uploadNoteScan: vi.fn(
    async (_userId: string, externalId: string) => `mock/${externalId}.png`,
  ),
}));
vi.mock("historio-kindle-scribe-notes-parser", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("historio-kindle-scribe-notes-parser")
    >();
  return {
    ...actual,
    transcribeNotes: vi.fn(async (notes: Array<{ id: string }>) =>
      notes.map((note) => ({
        id: note.id,
        transcription: `mock transcription for ${note.id}`,
        confidence: 0.99,
        isDiagram: false,
        model: "google/gemini-3.7-flash" as const,
      })),
    ),
  };
});

const { saveNewHighlights } = await import("./kindle-scribe");
const { db } = await import("@/lib/db");
const { books, highlights, userBooks } = await import("@/lib/db/schema");
const { createTestUser, deleteTestUsers } = await import("@/lib/test-utils/db");

const FIXTURE = fileURLToPath(
  new URL("./__fixtures__/weavers-scribes-kings.pdf", import.meta.url),
);

const users: string[] = [];
let asinToClean: string | null = null;
afterAll(async () => {
  await deleteTestUsers(users);
  // The fixture's real ASIN may belong to a book other data uses; only remove
  // it if no user is left holding it.
  if (asinToClean) {
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.asin, asinToClean));
    if (book) {
      const holders = await db
        .select()
        .from(userBooks)
        .where(eq(userBooks.bookId, book.id));
      if (holders.length === 0)
        await db.delete(books).where(eq(books.id, book.id));
    }
  }
});

describe("saveNewHighlights against the v3 schema (fixture PDF)", () => {
  it("creates the book, library entry and pending highlights, and a re-import adds none", async () => {
    const user = await createTestUser();
    users.push(user);
    const parsed = parseNotebook(new Uint8Array(await readFile(FIXTURE)));
    asinToClean = parsed.book.asin;
    expect(parsed.highlights.length).toBeGreaterThan(0);

    const first = await saveNewHighlights(parsed, {
      userId: user,
      ingestionEventId: null,
      transcribeOptions: { gatewayApiKey: "unused" },
    });
    expect(first.highlightsSaved).toBe(first.highlightsFound);

    const [link] = await db
      .select()
      .from(userBooks)
      .where(eq(userBooks.userId, user));
    expect(link).toMatchObject({ bookId: first.bookId, status: "active" });
    const rows = await db
      .select()
      .from(highlights)
      .where(eq(highlights.userId, user));
    expect(rows).toHaveLength(first.highlightsFound);
    expect(rows.every((r) => r.status === "pending")).toBe(true);
    const handwritten = rows.filter((r) => r.noteOrigin === "handwritten");
    expect(
      handwritten.every(
        (r) => r.noteText?.startsWith("mock transcription") && r.noteImagePath,
      ),
    ).toBe(true);

    const second = await saveNewHighlights(parsed, {
      userId: user,
      ingestionEventId: null,
      transcribeOptions: { gatewayApiKey: "unused" },
    });
    expect(second).toMatchObject({
      highlightsSaved: 0,
      highlightsSkippedAsDuplicate: first.highlightsFound,
    });
    expect(
      await db.select().from(highlights).where(eq(highlights.userId, user)),
    ).toHaveLength(first.highlightsFound);
  });

  it("brings back a book the user had removed", async () => {
    const user = await createTestUser();
    users.push(user);
    const parsed = parseNotebook(new Uint8Array(await readFile(FIXTURE)));
    const opts = {
      userId: user,
      ingestionEventId: null,
      transcribeOptions: { gatewayApiKey: "unused" },
    };
    await saveNewHighlights(parsed, opts);
    await db
      .update(userBooks)
      .set({ status: "removed" })
      .where(eq(userBooks.userId, user));

    await saveNewHighlights(parsed, opts);

    const [link] = await db
      .select()
      .from(userBooks)
      .where(eq(userBooks.userId, user));
    expect(link.status).toBe("active");
  });
});
