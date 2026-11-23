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
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

  it("an insight's highlight badge opens Highlights scoped to it", () => {
    setup();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Show highlights for Fall of Constantinople: 1",
      }),
    );
    expect(screen.getByPlaceholderText("Search highlights")).toBeTruthy();
    expect(screen.queryByText(/Ides of March/)).toBeNull();
    expect(screen.getByText(/Constantinople fell/)).toBeTruthy();
    expect(window.location.search).toContain("insight=i-fall");
  });

  it("toggles hidden insights with a switch", () => {
    setup();
    const toggle = screen.getByRole("switch");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(window.location.search).toContain("hidden=1");
  });

  it("pushes a history entry per section change and restores it on Back", () => {
    setup();
    const start = window.history.length;
    fireEvent.click(screen.getByRole("button", { name: /^Books/ }));
    expect(window.history.length).toBe(start + 1);
    fireEvent.change(screen.getByPlaceholderText("Search books"), {
      target: { value: "spqr" },
    });
    // Typing replaces the entry instead of adding one.
    expect(window.history.length).toBe(start + 1);
    act(() => {
      window.history.replaceState(null, "", "/library");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByPlaceholderText("Search insights")).toBeTruthy();
  });

  it("shows the period as m/d/yyyy and the highlight badge tooltip", () => {
    setup();
    expect(screen.getByText("5/29/1453")).toBeTruthy();
    const badge = screen.getByRole("button", {
      name: "Show highlights for Fall of Constantinople: 1",
    });
    expect(badge.getAttribute("title")).toBe("1 highlight");
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

describe("LibraryView filter builder", () => {
  function openFilter() {
    fireEvent.click(screen.getByRole("button", { name: /^Filter/ }));
    return screen.getByRole("dialog");
  }

  function setField(index: number, field: string) {
    fireEvent.change(screen.getAllByLabelText("Field")[index]!, {
      target: { value: field },
    });
  }

  const romeFilter = `filter=${encodeURIComponent(
    JSON.stringify({ c: [["area", "contains", "rome"]] }),
  )}`;

  it("has no Filter control on Books", () => {
    setup("lens=books");
    expect(screen.queryByRole("button", { name: /^Filter/ })).toBeNull();
  });

  it("narrows the table in the browser, with no server call, and mirrors it to the URL", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const actions = setup();
    openFilter();
    setField(0, "area");
    fireEvent.change(screen.getByLabelText("Area value"), {
      target: { value: "rome" },
    });
    expect(screen.queryByText("Fall of Constantinople")).toBeNull();
    expect(screen.getByText("Assassination of Caesar")).toBeTruthy();
    expect(screen.getByText("1 of 2 insights")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Filter (1)" })).toBeTruthy();
    expect(window.location.search).toContain("filter=");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(actions.hideInsight).not.toHaveBeenCalled();
  });

  it("converts a BC year to an astronomical year and keeps the era when a row is removed", () => {
    setup();
    openFilter();
    setField(0, "period");
    fireEvent.change(screen.getByLabelText("Period from era"), {
      target: { value: "BC" },
    });
    fireEvent.change(screen.getByLabelText("Period to era"), {
      target: { value: "BC" },
    });
    fireEvent.change(screen.getByLabelText("Period from"), {
      target: { value: "3500" },
    });
    fireEvent.change(screen.getByLabelText("Period to"), {
      target: { value: "3300" },
    });
    expect(decodeURIComponent(window.location.search)).toContain(
      "[-3499,-3299]",
    );
    fireEvent.click(screen.getByRole("button", { name: "+ Add condition" }));
    setField(1, "period");
    fireEvent.change(screen.getAllByLabelText("Period from")[1]!, {
      target: { value: "1300" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Remove condition" })[0]!,
    );
    // The surviving row is CE 1300, not the removed row's BC.
    expect(
      (screen.getByLabelText("Period from era") as HTMLSelectElement).value,
    ).toBe("CE");
    expect(
      (screen.getByLabelText("Period from") as HTMLInputElement).value,
    ).toBe("1300");
  });

  it("shows a type toggle for each insight type and filters by it", () => {
    setup();
    openFilter();
    for (const name of ["Event", "Person", "Place", "Concept"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: "Person" }));
    expect(
      screen
        .getByRole("button", { name: "Person" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByText("Nothing matches.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Event" }));
    expect(screen.getByText("Fall of Constantinople")).toBeTruthy();
  });

  it("joins conditions with the and/or select, which applies to every row", () => {
    setup();
    openFilter();
    setField(0, "area");
    fireEvent.change(screen.getByLabelText("Area value"), {
      target: { value: "rome" },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ Add condition" }));
    setField(1, "area");
    fireEvent.change(screen.getAllByLabelText("Area value")[1]!, {
      target: { value: "istanbul" },
    });
    expect(screen.getByText("Nothing matches.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Join conditions with"), {
      target: { value: "or" },
    });
    expect(screen.getByText("Fall of Constantinople")).toBeTruthy();
    expect(screen.getByText("Assassination of Caesar")).toBeTruthy();
    expect(decodeURIComponent(window.location.search)).toContain('"j":"or"');
  });

  it("ignores incomplete conditions and removes or clears conditions", () => {
    setup();
    openFilter();
    setField(0, "area");
    expect(screen.getByText("Fall of Constantinople")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Filter" })).toBeTruthy();
    expect(window.location.search).not.toContain("filter=");
    fireEvent.change(screen.getByLabelText("Area value"), {
      target: { value: "rome" },
    });
    expect(screen.queryByText("Fall of Constantinople")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove condition" }));
    expect(screen.getByText("Fall of Constantinople")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "+ Add condition" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.queryAllByLabelText("Field")).toHaveLength(0);
  });

  it("restores a filter from the URL and on Back/Forward", () => {
    setup(romeFilter);
    expect(screen.queryByText("Fall of Constantinople")).toBeNull();
    expect(screen.getByRole("button", { name: "Filter (1)" })).toBeTruthy();
    act(() => {
      window.history.replaceState(null, "", "/library");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByText("Fall of Constantinople")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Filter" })).toBeTruthy();
  });

  it("ignores a malformed filter in the URL", () => {
    setup("filter=%7Bbroken");
    expect(screen.getByText("Fall of Constantinople")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Filter" })).toBeTruthy();
  });

  it("drops the filter when the section changes", () => {
    setup(romeFilter);
    fireEvent.click(screen.getByRole("button", { name: /^Highlights/ }));
    expect(window.location.search).not.toContain("filter=");
    expect(screen.getByRole("button", { name: "Filter" })).toBeTruthy();
    expect(screen.getByText(/Ides of March/)).toBeTruthy();
  });

  it("clears the filter along with scope from Clear", () => {
    setup(romeFilter);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Fall of Constantinople")).toBeTruthy();
    expect(window.location.search).not.toContain("filter=");
  });

  it("combines with the insight scope chip on Highlights", () => {
    setup("lens=highlights&insight=i-fall");
    openFilter();
    setField(0, "status");
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    expect(screen.getByText("Nothing matches.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    fireEvent.click(screen.getByRole("button", { name: "Researched" }));
    expect(screen.getByText(/Constantinople fell/)).toBeTruthy();
    expect(screen.queryByText(/Ides of March/)).toBeNull();
    expect(screen.getByText(/In Fall of Constantinople/)).toBeTruthy();
  });

  it("offers only text operators for Linked insights, with no insight picker", () => {
    setup("lens=highlights");
    openFilter();
    setField(0, "insights");
    const options = Array.from(
      (screen.getByLabelText("Operator") as HTMLSelectElement).options,
    ).map((o) => o.textContent);
    expect(options).toEqual(["contains", "is empty", "is not empty"]);
    fireEvent.change(screen.getByLabelText("Linked insights value"), {
      target: { value: "caesar" },
    });
    expect(screen.getByText(/Ides of March/)).toBeTruthy();
    expect(screen.queryByText(/Constantinople fell/)).toBeNull();
  });

  it("closes on Escape and returns focus to the Filter button", () => {
    setup();
    const dialog = openFilter();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Filter/ }),
    );
  });

  it("closes on an outside click", () => {
    setup();
    openFilter();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
