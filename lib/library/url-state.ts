import type { Lens } from "@/lib/library/types";

export type ViewState = {
  lens: Lens;
  q: string;
  bookId: string | null;
  highlightId: string | null;
  /** Highlights lens only: the insight whose highlights are shown. */
  insightId: string | null;
  showHidden: boolean;
};

export const DEFAULT_LENS: Lens = "insights";

const LENSES: readonly Lens[] = ["books", "highlights", "insights"];

export const DEFAULT_VIEW_STATE: ViewState = {
  lens: DEFAULT_LENS,
  q: "",
  bookId: null,
  highlightId: null,
  insightId: null,
  showHidden: false,
};

/** Restores a view from `?lens=&q=&book=&highlight=&insight=&hidden=`. Unknown input is ignored. */
export function parseViewState(search: string): ViewState {
  const params = new URLSearchParams(search);
  const lens = params.get("lens");
  return {
    lens: LENSES.includes(lens as Lens) ? (lens as Lens) : DEFAULT_LENS,
    q: params.get("q") ?? "",
    bookId: params.get("book") || null,
    highlightId: params.get("highlight") || null,
    insightId: params.get("insight") || null,
    showHidden: params.get("hidden") === "1",
  };
}

/** The query string (with no leading "?") for a view; defaults are omitted. */
export function serializeViewState(state: ViewState): string {
  const params = new URLSearchParams();
  if (state.lens !== DEFAULT_LENS) params.set("lens", state.lens);
  if (state.q) params.set("q", state.q);
  if (state.bookId) params.set("book", state.bookId);
  if (state.highlightId) params.set("highlight", state.highlightId);
  if (state.insightId) params.set("insight", state.insightId);
  if (state.showHidden) params.set("hidden", "1");
  return params.toString();
}
