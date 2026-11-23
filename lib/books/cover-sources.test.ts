import { afterEach, describe, expect, it, vi } from "vitest";

import { findBookCover, titlesMatch } from "./cover-sources";

const bigImage = () =>
  new Response(new Uint8Array(5_000), {
    headers: { "content-type": "image/jpeg" },
  });
const placeholder = () =>
  new Response(new Uint8Array(43), {
    headers: { "content-type": "image/gif" },
  });
const notFound = () => new Response("nope", { status: 404 });

afterEach(() => vi.unstubAllGlobals());

describe("titlesMatch", () => {
  it("matches subtitle differences and rejects unrelated titles", () => {
    expect(titlesMatch("SPQR: A History of Ancient Rome", "SPQR")).toBe(true);
    expect(titlesMatch("The Martian", "Atomic Habits")).toBe(false);
  });
});

describe("findBookCover", () => {
  it("uses Amazon first", async () => {
    const fetchMock = vi.fn().mockResolvedValue(bigImage());
    vi.stubGlobal("fetch", fetchMock);
    const cover = await findBookCover({ asin: "B000FCK5YE", title: "1776" });
    expect(cover?.source).toBe("amazon");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("skips Amazon's 1x1 placeholder and tries Open Library by ISBN for print ASINs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(placeholder())
      .mockResolvedValueOnce(bigImage());
    vi.stubGlobal("fetch", fetchMock);
    const cover = await findBookCover({ asin: "0062316117", title: "Sapiens" });
    expect(cover?.source).toBe("openlibrary-isbn");
  });

  it("searches Open Library by title for Kindle-only ASINs, ignoring mismatched titles", async () => {
    const search = (title: string) =>
      new Response(JSON.stringify({ docs: [{ title, cover_i: 7 }] }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(search("The Martian"))
      .mockResolvedValueOnce(bigImage());
    vi.stubGlobal("fetch", fetchMock);
    const cover = await findBookCover({
      asin: "B00EMXBDMA",
      title: "The Martian",
    });
    expect(cover?.source).toBe("openlibrary-search");

    fetchMock
      .mockResolvedValueOnce(notFound())
      .mockResolvedValueOnce(search("Something Else Entirely"));
    expect(
      await findBookCover({ asin: "B00EMXBDMA", title: "The Martian" }),
    ).toBeNull();
  });

  it("returns null instead of throwing when every source errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await findBookCover({ asin: "B0X", title: "T" })).toBeNull();
  });
});
