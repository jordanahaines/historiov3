// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Handwritten note" }),
      ).toBeTruthy(),
    );
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

describe("Insight drawer", () => {
  function row(title: string) {
    const el = screen.getByText(title).closest("tr");
    if (!el) throw new Error(`no row for ${title}`);
    return el;
  }
  const dialog = () => screen.queryByRole("dialog", { name: /.+/ });
  const openFall = () => fireEvent.click(row("Fall of Constantinople"));

  it("opens on row click with the full content", () => {
    setup();
    expect(dialog()).toBeNull();
    openFall();
    const d = within(dialog()!);
    expect(
      d.getByRole("heading", { name: "Fall of Constantinople" }),
    ).toBeTruthy();
    expect(d.getByText("event")).toBeTruthy();
    expect(d.getByText("5/29/1453 · Istanbul")).toBeTruthy();
    expect(d.getByText("Also: Conquest of Constantinople")).toBeTruthy();
    expect(
      d.getByText("The Ottoman capture of the Byzantine capital."),
    ).toBeTruthy();
    expect(d.getByText("From your reading")).toBeTruthy();
    expect(
      d.getByText("Constantinople fell to the Ottomans in 1453."),
    ).toBeTruthy();
    expect(d.getByText("check the date")).toBeTruthy();
    expect(
      d.getByRole("button", { name: "Show handwritten note" }),
    ).toBeTruthy();
    expect(d.queryByRole("button", { name: /Show on map/ })).toBeNull();
    expect(window.location.search).toBe("?drawer=i-fall");
    expect(document.activeElement).toBe(dialog());
  });

  it("does not open from the badge, hide or restore buttons", async () => {
    setup("hidden=1");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Show highlights for Assassination of Caesar: 1",
      }),
    );
    expect(dialog()).toBeNull();
    cleanup();
    setup("hidden=1");
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Hide Assassination of Caesar" }),
      );
    });
    expect(dialog()).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Restore Silk/ }));
    });
    expect(dialog()).toBeNull();
  });

  it("opens from the keyboard with Enter or Space on a focused row", () => {
    setup();
    const r = row("Fall of Constantinople");
    expect(r.tabIndex).toBe(0);
    fireEvent.keyDown(r, { key: "Enter" });
    expect(dialog()).toBeTruthy();
    cleanup();
    setup();
    fireEvent.keyDown(row("Fall of Constantinople"), { key: " " });
    expect(dialog()).toBeTruthy();
  });

  it("switches to another row without closing", () => {
    setup();
    openFall();
    fireEvent.click(row("Assassination of Caesar"));
    expect(
      within(dialog()!).getByRole("heading", {
        name: "Assassination of Caesar",
      }),
    ).toBeTruthy();
    expect(window.location.search).toBe("?drawer=i-ides");
  });

  it("closes with the close icon, Escape, an outside click and a lens switch", () => {
    setup();
    openFall();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(row("Fall of Constantinople"));
    expect(window.location.search).toBe("");

    openFall();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(row("Fall of Constantinople"));

    openFall();
    fireEvent.pointerDown(dialog()!);
    expect(dialog()).toBeTruthy();
    fireEvent.pointerDown(row("Assassination of Caesar"));
    expect(dialog()).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(dialog()).toBeNull();

    openFall();
    fireEvent.click(screen.getByRole("button", { name: /^Books/ }));
    expect(dialog()).toBeNull();
    expect(window.location.search).not.toContain("drawer");
  });

  it("pushes on open, replaces on switch and close, and restores on popstate", () => {
    setup();
    const start = window.history.length;
    openFall();
    expect(window.history.length).toBe(start + 1);
    fireEvent.click(row("Assassination of Caesar"));
    expect(window.history.length).toBe(start + 1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(window.history.length).toBe(start + 1);

    act(() => {
      window.history.replaceState(null, "", "/library?drawer=i-fall");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(dialog()).toBeTruthy();
    act(() => {
      window.history.replaceState(null, "", "/library");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(dialog()).toBeNull();
  });

  it("opens from the URL, including a hidden insight, and ignores bad ids and other lenses", () => {
    setup("drawer=i-silk");
    const d = within(dialog()!);
    expect(d.getByText("Hidden")).toBeTruthy();
    expect(
      d.getByRole("switch", { name: "Visible" }).getAttribute("aria-checked"),
    ).toBe("false");
    cleanup();
    setup("drawer=nope");
    expect(dialog()).toBeNull();
    cleanup();
    setup("lens=books&drawer=i-fall");
    expect(dialog()).toBeNull();
  });

  it("keeps the drawer through search and Show hidden changes", () => {
    setup("drawer=i-fall");
    fireEvent.change(screen.getByPlaceholderText("Search insights"), {
      target: { value: "fall" },
    });
    fireEvent.click(screen.getByRole("switch", { name: /Show hidden/ }));
    expect(dialog()).toBeTruthy();
    expect(window.location.search).toContain("drawer=i-fall");
    expect(window.location.search).toContain("q=fall");
    expect(window.location.search).toContain("hidden=1");
  });

  it("omits missing area, aliases and description", () => {
    setup("drawer=i-silk");
    const d = within(dialog()!);
    expect(d.queryByText(/Also:/)).toBeNull();
    expect(
      d.getByText("Silk travelled west along the oldest roads."),
    ).toBeTruthy();
    expect(d.queryByText("Istanbul")).toBeNull();
    expect(
      d.queryByRole("button", { name: "Show handwritten note" }),
    ).toBeNull();
  });

  it("lists every highlight in a scrollable area", () => {
    const data = makeLibrary();
    data.insights[0]!.highlightIds = ["h-1", "h-2", "h-3"];
    setup("drawer=i-fall", makeActions(), data);
    const d = within(dialog()!);
    expect(d.getAllByRole("listitem")).toHaveLength(3);
    expect(d.getByText(/Ides of March/)).toBeTruthy();
  });

  it("keeps the drawer open when Escape is pressed in the search field", () => {
    setup("drawer=i-fall");
    const search = screen.getByPlaceholderText("Search insights");
    search.focus();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(dialog()).toBeTruthy();
  });

  it("closes only the note popover on Escape, not the drawer", async () => {
    setup("drawer=i-fall");
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Show handwritten note" }),
      );
    });
    expect(
      screen.getByRole("dialog", { name: "Handwritten note" }),
    ).toBeTruthy();
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Show handwritten note" }),
      {
        key: "Escape",
      },
    );
    expect(
      screen.queryByRole("dialog", { name: "Handwritten note" }),
    ).toBeNull();
    expect(dialog()).toBeTruthy();
  });

  it("lists only highlights in the library", () => {
    const data = makeLibrary();
    data.insights[0]!.highlightIds = ["h-1", "h-gone"];
    setup("drawer=i-fall", makeActions(), data);
    expect(within(dialog()!).getAllByRole("listitem")).toHaveLength(1);
  });

  it("hides from the drawer with the Visible switch, keeping it open and removing the row", async () => {
    const actions = setup("drawer=i-fall");
    const toggle = () =>
      within(dialog()!).getByRole("switch", { name: "Visible" });
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    await act(async () => {
      fireEvent.click(toggle());
    });
    expect(actions.hideInsight).toHaveBeenCalledTimes(1);
    expect(actions.hideInsight).toHaveBeenCalledWith("i-fall");
    expect(within(dialog()!).getByText("Hidden")).toBeTruthy();
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    expect(screen.getAllByText("Fall of Constantinople")).toHaveLength(1);

    await act(async () => {
      fireEvent.click(toggle());
    });
    expect(actions.restoreInsight).toHaveBeenCalledWith("i-fall");
    expect(toggle().getAttribute("aria-checked")).toBe("true");
  });

  it("rolls back a failed hide and shows the error in the drawer", async () => {
    setup(
      "drawer=i-fall",
      makeActions({
        hideInsight: vi.fn().mockResolvedValue({ ok: false, error: "Nope." }),
      }),
    );
    await act(async () => {
      fireEvent.click(
        within(dialog()!).getByRole("switch", { name: "Visible" }),
      );
    });
    const d = within(dialog()!);
    expect(d.getByRole("alert").textContent).toBe("Nope.");
    expect(
      d.getByRole("switch", { name: "Visible" }).getAttribute("aria-checked"),
    ).toBe("true");
  });
});

describe("Highlight drawer", () => {
  const dialog = () => screen.queryByRole("dialog", { name: "Highlight" });
  const rowOf = (text: RegExp) => {
    const el = screen.getByText(text).closest("tr");
    if (!el) throw new Error("no row");
    return el;
  };
  const openFirst = () => fireEvent.click(rowOf(/Constantinople fell/));

  it("opens on row click with the full content", () => {
    setup("lens=highlights");
    expect(dialog()).toBeNull();
    openFirst();
    const d = within(dialog()!);
    expect(
      d.getByText("Constantinople fell to the Ottomans in 1453."),
    ).toBeTruthy();
    expect(d.getByText("Captured 11/9/2026 · Researched")).toBeTruthy();
    expect(d.getByText("Your note")).toBeTruthy();
    expect(d.getByText("check the date")).toBeTruthy();
    expect(
      d.getByRole("button", { name: "Handwritten note · page 12" }),
    ).toBeTruthy();
    expect(d.getAllByText("The Silk Roads").length).toBeGreaterThan(0);
    expect(d.getByText("Peter Frankopan · p. 12")).toBeTruthy();
    expect(d.getByText("Became 1 insight")).toBeTruthy();
    expect(d.getByText("Fall of Constantinople")).toBeTruthy();
    expect(d.getByText("5/29/1453")).toBeTruthy();
    expect(window.location.search).toBe("?lens=highlights&drawer=h-1");
    expect(document.activeElement).toBe(dialog());
  });

  it("does not open from the insight links or the note popover", async () => {
    setup("lens=highlights");
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Show handwritten note" }),
      );
    });
    expect(dialog()).toBeNull();
  });

  it("opens from the keyboard, closes with Escape and returns focus to the row", () => {
    setup("lens=highlights");
    const row = rowOf(/Constantinople fell/);
    fireEvent.keyDown(row, { key: "Enter" });
    expect(dialog()).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(row);
  });

  it("restores from the URL, ignores unknown ids and other lenses", () => {
    setup("lens=highlights&drawer=h-3");
    expect(within(dialog()!).getByText("Became 1 insight")).toBeTruthy();
    cleanup();
    setup("lens=highlights&drawer=nope");
    expect(dialog()).toBeNull();
    cleanup();
    setup("lens=highlights&drawer=i-fall");
    expect(dialog()).toBeNull();
  });

  it("shows no note section and an empty insights state when there is nothing", () => {
    setup("lens=highlights&drawer=h-2");
    const d = within(dialog()!);
    expect(d.queryByText("Your note")).toBeNull();
    expect(d.getByText("No insights yet")).toBeTruthy();
  });

  it("opens an insight's drawer from its row", () => {
    setup("lens=highlights&drawer=h-1");
    fireEvent.click(
      within(dialog()!).getByRole("button", { name: /Fall of Constantinople/ }),
    );
    expect(screen.getByPlaceholderText("Search insights")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Fall of Constantinople" }),
    ).toBeTruthy();
    expect(window.location.search).toBe("?drawer=i-fall");
  });

  it("Open book scopes Highlights to the book and closes the drawer", () => {
    setup("lens=highlights&drawer=h-1");
    fireEvent.click(
      within(dialog()!).getByRole("button", { name: "Open book" }),
    );
    expect(dialog()).toBeNull();
    expect(window.location.search).toContain("book=book-silk");
    expect(screen.queryByText(/Ides of March/)).toBeNull();
  });

  it("copies the quote", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    setup("lens=highlights&drawer=h-1");
    await act(async () => {
      fireEvent.click(
        within(dialog()!).getByRole("button", { name: "Copy quote" }),
      );
    });
    expect(writeText).toHaveBeenCalledWith(
      "Constantinople fell to the Ottomans in 1453.",
    );
    expect(
      within(dialog()!).getByRole("button", { name: "Copied" }),
    ).toBeTruthy();
  });

  it("closes on a lens switch", () => {
    setup("lens=highlights&drawer=h-1");
    fireEvent.click(screen.getByRole("button", { name: /^Books/ }));
    expect(dialog()).toBeNull();
  });
});
