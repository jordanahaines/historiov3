// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LibraryView } from "@/components/library/LibraryView";
import type { LibraryActions } from "@/components/library/library-actions";
import { makeLibrary } from "@/lib/library/fixtures";

function makeActions(over: Partial<LibraryActions> = {}): LibraryActions {
  return {
    hideInsight: vi.fn().mockResolvedValue({ ok: true }),
    restoreInsight: vi.fn().mockResolvedValue({ ok: true }),
    getNoteImageUrl: vi
      .fn()
      .mockResolvedValue({ ok: true, url: "https://signed/x.png" }),
    ...over,
  };
}

function setup(search = "", actions = makeActions(), data = makeLibrary()) {
  window.history.replaceState(
    null,
    "",
    search ? `/library?${search}` : "/library",
  );
  render(<LibraryView data={data} initialSearch={search} actions={actions} />);
  return actions;
}

beforeEach(() => window.history.replaceState(null, "", "/library"));
afterEach(cleanup);

describe("LibraryView", () => {
  it("opens on Insights by default with counts for every section", () => {
    setup();
    expect(
      screen
        .getByRole("button", { name: /Insights/ })
        .getAttribute("aria-current"),
    ).toBe("true");
    expect(screen.getByText("Fall of Constantinople")).toBeTruthy();
    // i-silk is hidden, so only two published insights count and show.
    expect(screen.queryByText("Silk insight")).toBeNull();
  });

  it("filters client-side by search and mirrors it to the URL", () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText("Search insights"), {
      target: { value: "caesar" },
    });
    expect(screen.queryByText("Fall of Constantinople")).toBeNull();
    expect(screen.getByText("Assassination of Caesar")).toBeTruthy();
    expect(window.location.search).toContain("q=caesar");
  });

  it("restores the view from the URL", () => {
    setup("lens=books");
    expect(screen.getByPlaceholderText("Search books")).toBeTruthy();
    expect(screen.getAllByText("SPQR").length).toBeGreaterThan(0);
  });

  it("a book's highlight tile scopes Highlights to that book, and the chip clears it", () => {
    setup("lens=books");
    fireEvent.click(
      screen.getByRole("button", {
        name: /The Silk Roads.*2 highlights|Highlights.*2 highlights/,
      }),
    );
    expect(screen.getByPlaceholderText("Search highlights")).toBeTruthy();
    expect(screen.queryByText(/Ides of March/)).toBeNull();
    expect(window.location.search).toContain("book=book-silk");
    fireEvent.click(screen.getByRole("button", { name: /Remove scope/ }));
    expect(screen.getByText(/Ides of March/)).toBeTruthy();
    expect(window.location.search).not.toContain("book=");
  });

  it("shows an empty state for no matches and for an empty library", () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText("Search insights"), {
      target: { value: "zzzz" },
    });
    expect(screen.getByText("Nothing matches.")).toBeTruthy();
    cleanup();
    setup("", makeActions(), { books: [], highlights: [], insights: [] });
    expect(screen.getByText(/No books yet/)).toBeTruthy();
  });

  it("hides an insight optimistically and calls the action", async () => {
    const actions = setup();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Hide Fall of Constantinople" }),
      );
    });
    expect(actions.hideInsight).toHaveBeenCalledWith("i-fall");
    expect(screen.queryByText("Fall of Constantinople")).toBeNull();
  });

  it("rolls a failed hide back and shows the error", async () => {
    setup(
      "",
      makeActions({
        hideInsight: vi
          .fn()
          .mockResolvedValue({ ok: false, error: "Insight not found." }),
      }),
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Hide Fall of Constantinople" }),
      );
    });
    expect(screen.getByText("Fall of Constantinople")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "Insight not found.",
    );
  });

  it("rolls back when the action rejects", async () => {
    setup(
      "",
      makeActions({
        hideInsight: vi.fn().mockRejectedValue(new Error("network")),
      }),
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Hide Fall of Constantinople" }),
      );
    });
    expect(screen.getByText("Fall of Constantinople")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("shows hidden insights on request and restores one", async () => {
    const actions = setup("hidden=1");
    const restore = screen.getByRole("button", { name: /Restore/ });
    await act(async () => {
      fireEvent.click(restore);
    });
    expect(actions.restoreInsight).toHaveBeenCalled();
  });

  it("requests the note image only when the popover opens", async () => {
    const actions = setup("lens=highlights");
    expect(actions.getNoteImageUrl).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Show handwritten note" }),
      );
    });
    expect(actions.getNoteImageUrl).toHaveBeenCalledWith("h-1");
    await waitFor(() => expect(screen.getByRole("img")).toBeTruthy());
  });

  it("shows an error in the popover when the url can't be loaded", async () => {
    setup(
      "lens=highlights",
      makeActions({
        getNoteImageUrl: vi.fn().mockResolvedValue({ ok: false, error: "x" }),
      }),
    );
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Show handwritten note" }),
      );
    });
    expect(screen.getByText("Couldn't load the note image.")).toBeTruthy();
  });
});
