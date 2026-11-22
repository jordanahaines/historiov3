"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { BooksTable } from "@/components/library/BooksTable";
import { HighlightsTable } from "@/components/library/HighlightsTable";
import { InsightsTable } from "@/components/library/InsightsTable";
import type { LibraryActions } from "@/components/library/library-actions";
import { ScopeBar, type ScopeChip } from "@/components/library/ScopeBar";
import { SearchField } from "@/components/library/SearchField";
import { SectionMenu } from "@/components/library/SectionMenu";
import { applyInsightStatus } from "@/lib/library/apply-insight-status";
import {
  filterBooks,
  filterHighlights,
  filterInsights,
  hiddenCount,
  sectionCounts,
  type SortDirection,
} from "@/lib/library/filter";
import type {
  InsightStatus,
  LibraryData,
  LibraryHighlight,
  Lens,
} from "@/lib/library/types";
import { parseViewState, serializeViewState } from "@/lib/library/url-state";

type LibraryViewProps = {
  data: LibraryData;
  /** The URL's query string at load, so a shared link restores the view. */
  initialSearch: string;
  actions: LibraryActions;
};

const PLACEHOLDERS: Record<Lens, string> = {
  books: "Search books",
  highlights: "Search highlights",
  insights: "Search insights",
};

/** Parses the URL, dropping scope ids that aren't in this library (stale or foreign links). */
function restoreView(search: string, data: LibraryData) {
  const parsed = parseViewState(search);
  return {
    ...parsed,
    bookId: data.books.some((b) => b.id === parsed.bookId)
      ? parsed.bookId
      : null,
    highlightId: data.highlights.some((h) => h.id === parsed.highlightId)
      ? parsed.highlightId
      : null,
    insightId: data.insights.some((i) => i.id === parsed.insightId)
      ? parsed.insightId
      : null,
  };
}

function firstWords(text: string, count = 6): string {
  const words = text.trim().split(/\s+/);
  return words.length > count ? `${words.slice(0, count).join(" ")}…` : text;
}

/**
 * The Library. The server loads everything once; lens, search, scope, sort and
 * hidden-visibility are all state in this component, so changing them never
 * re-renders on the server. The URL mirrors that state via replaceState.
 */
export function LibraryView({
  data: initialData,
  initialSearch,
  actions,
}: LibraryViewProps) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState(() =>
    restoreView(initialSearch, initialData),
  );
  const previousView = useRef(view);
  // The sticky mast's height, so the table header can stick just below it.
  const mastRef = useRef<HTMLDivElement>(null);
  const [mastHeight, setMastHeight] = useState(0);
  useEffect(() => {
    const mast = mastRef.current;
    if (!mast || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      setMastHeight(mast.getBoundingClientRect().height),
    );
    observer.observe(mast);
    return () => observer.disconnect();
  }, []);
  const inFlight = useRef(new Set<string>());
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Mirror state to the URL without navigating. Changing section or scope
  // pushes a history entry, so Back returns to the previous view; typing a
  // search or toggling hidden replaces the current one.
  useEffect(() => {
    const previous = previousView.current;
    previousView.current = view;
    const query = serializeViewState(view);
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (url === `${window.location.pathname}${window.location.search}`) return;
    const navigated =
      previous.lens !== view.lens ||
      previous.bookId !== view.bookId ||
      previous.highlightId !== view.highlightId ||
      previous.insightId !== view.insightId;
    if (navigated) window.history.pushState(null, "", url);
    else window.history.replaceState(window.history.state, "", url);
  }, [view]);

  // Back / Forward: restore the view from the URL we landed on.
  useEffect(() => {
    function onPopState() {
      const restored = restoreView(window.location.search, initialData);
      previousView.current = restored;
      setView(restored);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initialData]);

  const { lens, q, showHidden } = view;
  const scopeBook = data.books.find((book) => book.id === view.bookId) ?? null;
  const scopeHighlight =
    data.highlights.find((highlight) => highlight.id === view.highlightId) ??
    null;
  const scopeInsight =
    data.insights.find((insight) => insight.id === view.insightId) ?? null;
  const scope = useMemo(
    () => ({
      bookId: scopeBook?.id,
      highlightId: lens === "insights" ? scopeHighlight?.id : undefined,
      insightHighlightIds:
        lens === "highlights" ? scopeInsight?.highlightIds : undefined,
    }),
    [scopeBook, scopeHighlight, scopeInsight, lens],
  );

  const counts = sectionCounts(data);
  const hidden = hiddenCount(data.insights);

  const books = useMemo(() => filterBooks(data.books, q), [data.books, q]);
  const highlights = useMemo(
    () => filterHighlights(data.highlights, q, scope),
    [data.highlights, q, scope],
  );
  const insights = useMemo(
    () => filterInsights(data.insights, q, scope, { showHidden, direction }),
    [data.insights, q, scope, showHidden, direction],
  );
  const insightTotal = useMemo(
    () =>
      filterInsights(data.insights, "", {}, { showHidden, direction }).length,
    [data.insights, showHidden, direction],
  );

  const chips: ScopeChip[] = [];
  if (lens !== "books" && scopeBook) {
    chips.push({ key: "book", label: scopeBook.title });
  }
  if (lens === "insights" && scopeHighlight) {
    chips.push({
      key: "highlight",
      label: `Highlight: ${firstWords(scopeHighlight.text)}`,
    });
  }

  if (lens === "highlights" && scopeInsight) {
    chips.push({ key: "insight", label: scopeInsight.title });
  }

  const shownCount =
    lens === "books"
      ? books.length
      : lens === "highlights"
        ? highlights.length
        : insights.length;
  const totalCount =
    lens === "books"
      ? data.books.length
      : lens === "highlights"
        ? data.highlights.length
        : insightTotal;
  const narrowed = shownCount !== totalCount;
  const resultText = narrowed
    ? `${shownCount} of ${totalCount} ${lens}`
    : `${totalCount} ${lens}`;

  function selectLens(next: Lens) {
    setView((current) => ({
      ...current,
      lens: next,
      bookId: null,
      highlightId: null,
      insightId: null,
    }));
  }

  function removeChip(key: string) {
    setView((current) =>
      key === "book"
        ? { ...current, bookId: null }
        : key === "insight"
          ? { ...current, insightId: null }
          : { ...current, highlightId: null },
    );
  }

  async function changeStatus(id: string, status: InsightStatus) {
    // One request per insight at a time, so a late failure can't undo a newer change.
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    const inverse: InsightStatus = status === "hidden" ? "published" : "hidden";
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)),
    );
    setData((current) => applyInsightStatus(current, id, status));
    let error: string | null = null;
    try {
      const result = await (status === "hidden"
        ? actions.hideInsight(id)
        : actions.restoreInsight(id));
      if (!result.ok) error = result.error;
    } catch {
      error = "Couldn't update this insight. Try again.";
    }
    if (error) {
      const message = error;
      setData((current) => applyInsightStatus(current, id, inverse));
      setErrors((current) => ({ ...current, [id]: message }));
    }
    inFlight.current.delete(id);
  }

  function showHighlightInsights(highlight: LibraryHighlight) {
    setView((current) => ({
      ...current,
      lens: "insights",
      bookId: null,
      highlightId: highlight.id,
      insightId: null,
    }));
  }

  function showInsightHighlights(insightId: string) {
    setView((current) => ({
      ...current,
      lens: "highlights",
      bookId: null,
      highlightId: null,
      insightId,
    }));
  }

  const emptyLibrary = data.books.length === 0;

  return (
    <div
      className="mx-auto w-full max-w-[1400px] px-6 pb-6"
      style={{ "--mast-h": `${mastHeight}px` } as React.CSSProperties}
    >
      <div
        ref={mastRef}
        className="bg-paper sticky top-[var(--nav-h)] z-20 -mx-6 px-6 pt-5 pb-1"
      >
        <SectionMenu lens={lens} counts={counts} onSelect={selectLens} />
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1">
          <SearchField
            value={q}
            placeholder={PLACEHOLDERS[lens]}
            onChange={(value) =>
              setView((current) => ({ ...current, q: value }))
            }
          />
          <div className="min-w-0 flex-1">
            <ScopeBar
              chips={chips}
              onRemoveChip={removeChip}
              onClear={() =>
                setView((current) => ({
                  ...current,
                  bookId: null,
                  highlightId: null,
                  insightId: null,
                }))
              }
              hidden={
                lens === "insights"
                  ? {
                      count: hidden,
                      checked: showHidden,
                      onChange: (next) =>
                        setView((current) => ({
                          ...current,
                          showHidden: next,
                        })),
                    }
                  : undefined
              }
              resultText={resultText}
            />
          </div>
        </div>
      </div>
      <div className="mt-2">
        {emptyLibrary ? (
          <p className="text-ink-secondary py-10">
            No books yet. Send a notebook from your Kindle Scribe.
          </p>
        ) : shownCount === 0 ? (
          <p className="text-ink-secondary py-10">Nothing matches.</p>
        ) : lens === "books" ? (
          <BooksTable
            books={books}
            onShowHighlights={(bookId) =>
              setView((current) => ({
                ...current,
                lens: "highlights",
                bookId,
                highlightId: null,
                insightId: null,
              }))
            }
            onShowInsights={(bookId) =>
              setView((current) => ({
                ...current,
                lens: "insights",
                bookId,
                highlightId: null,
                insightId: null,
              }))
            }
          />
        ) : lens === "highlights" ? (
          <HighlightsTable
            highlights={highlights}
            onShowInsights={showHighlightInsights}
            getNoteImageUrl={actions.getNoteImageUrl}
          />
        ) : (
          <InsightsTable
            insights={insights}
            direction={direction}
            errors={errors}
            onToggleSort={() =>
              setDirection((current) => (current === "asc" ? "desc" : "asc"))
            }
            onShowHighlights={showInsightHighlights}
            onHide={(id) => void changeStatus(id, "hidden")}
            onRestore={(id) => void changeStatus(id, "published")}
          />
        )}
      </div>
    </div>
  );
}
