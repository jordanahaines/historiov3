import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  HighlightRecord,
  ParsedNotebook,
} from "historio-kindle-scribe-notes-parser";

const findOrCreateBookByAsin = vi.fn();
const ensureUserBook = vi.fn();
const findExistingExternalIds = vi.fn();
const createHighlights = vi.fn();
const uploadNoteScan = vi.fn();
const transcribeNotes = vi.fn();

vi.mock("@/lib/authz/books", () => ({
  findOrCreateBookByAsin,
  ensureUserBook,
}));
vi.mock("@/lib/authz/highlights", () => ({
  findExistingExternalIds,
  createHighlights,
}));
vi.mock("@/lib/storage/buckets", () => ({ uploadNoteScan }));
vi.mock("historio-kindle-scribe-notes-parser", () => ({
  transcribeNotes,
  parseNotebook: vi.fn(),
}));

const { saveNewHighlights, externalIdFor } = await import("./kindle-scribe");

const BOOK = { id: "book-1", asin: "B000", title: "Title", author: "Author" };

const typed: HighlightRecord = {
  chapter: "One",
  page: 12,
  text: "Typed highlight",
  date: new Date("2025-01-02"),
  note: { type: "typed", text: "my note" },
};
const handwritten: HighlightRecord = {
  chapter: null,
  page: 20,
  text: "Handwritten highlight",
  date: new Date("2025-01-03"),
  note: {
    type: "handwritten",
    image: new Uint8Array([1, 2, 3]),
    width: 1,
    height: 1,
  },
};

function notebook(highlights: HighlightRecord[]): ParsedNotebook {
  return {
    book: { title: "Title", author: "Author", asin: "B000" },
    highlights,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findOrCreateBookByAsin.mockResolvedValue({ book: BOOK, created: true });
  findExistingExternalIds.mockResolvedValue(new Set());
  createHighlights.mockImplementation(async (inputs: unknown[]) => inputs);
  uploadNoteScan.mockImplementation(
    async (_user: string, externalId: string) => `u/${externalId}.png`,
  );
  transcribeNotes.mockImplementation(async (notes: Array<{ id: string }>) =>
    notes.map((n) => ({ id: n.id, transcription: `text for ${n.id}` })),
  );
});

describe("externalIdFor", () => {
  it("is p<page>-<sha256(text)> and stable", () => {
    const hash = createHash("sha256").update("Typed highlight").digest("hex");
    expect(externalIdFor(typed)).toBe(`p12-${hash}`);
    expect(externalIdFor(typed)).toBe(externalIdFor({ ...typed }));
  });

  it("differs across pages for the same text", () => {
    expect(externalIdFor({ ...typed, page: 13 })).not.toBe(
      externalIdFor(typed),
    );
  });
});

describe("saveNewHighlights", () => {
  const input = {
    userId: "user-1",
    ingestionEventId: "event-1",
    transcribeOptions: { gatewayApiKey: "k" },
  };

  it("puts the book in the user's library before inserting highlights", async () => {
    const order: string[] = [];
    ensureUserBook.mockImplementation(async () => void order.push("userBook"));
    createHighlights.mockImplementation(async (rows: unknown[]) => {
      order.push("highlights");
      return rows;
    });
    await saveNewHighlights(notebook([typed]), input);
    expect(order).toEqual(["userBook", "highlights"]);
    expect(ensureUserBook).toHaveBeenCalledWith("user-1", "book-1");
  });

  it("saves typed notes as-is and transcribes handwritten ones with a scan path", async () => {
    await saveNewHighlights(notebook([typed, handwritten]), input);
    const rows = createHighlights.mock.calls[0][0];
    expect(rows[0]).toMatchObject({
      userId: "user-1",
      ingestionEventId: "event-1",
      noteText: "my note",
      noteOrigin: "typed",
      noteImagePath: null,
    });
    expect(rows[1]).toMatchObject({
      noteOrigin: "handwritten",
      noteText: expect.stringContaining("text for p20-"),
      noteImagePath: expect.stringContaining("p20-"),
    });
    expect(transcribeNotes).toHaveBeenCalledTimes(1);
  });

  it("skips highlights already imported and reports counts", async () => {
    findExistingExternalIds.mockResolvedValue(new Set([externalIdFor(typed)]));
    createHighlights.mockImplementation(async (rows: unknown[]) => rows);
    const summary = await saveNewHighlights(
      notebook([typed, handwritten]),
      input,
    );
    expect(summary).toMatchObject({
      highlightsFound: 2,
      highlightsSaved: 1,
      highlightsSkippedAsDuplicate: 1,
    });
    expect(createHighlights.mock.calls[0][0]).toHaveLength(1);
  });

  it("does not transcribe or upload when nothing is new", async () => {
    findExistingExternalIds.mockResolvedValue(
      new Set([externalIdFor(handwritten)]),
    );
    createHighlights.mockResolvedValue([]);
    await saveNewHighlights(notebook([handwritten]), input);
    expect(transcribeNotes).not.toHaveBeenCalled();
    expect(uploadNoteScan).not.toHaveBeenCalled();
  });

  it("requires transcribeOptions for new handwritten notes", async () => {
    await expect(
      saveNewHighlights(notebook([handwritten]), {
        userId: "user-1",
        ingestionEventId: null,
      }),
    ).rejects.toThrow(/transcribeOptions/);
  });
});
