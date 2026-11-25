import {
  EMPTY_FILTER,
  parseFilter,
  serializeFilter,
  type FilterState,
} from "@/lib/library/filter-conditions";
import type { Lens } from "@/lib/library/types";

export type ViewState = {
  lens: Lens;
  q: string;
  bookId: string | null;
  highlightId: string | null;
  /** Highlights lens only: the insight whose highlights are shown. */
  insightId: string | null;
  /** Insights lens only: the insight open in the drawer (separate from `insightId`). */
  drawerId: string | null;
  showHidden: boolean;
  /** Highlights and Insights lenses only; belongs to the current lens. */
  filter: FilterState;
};

export const DEFAULT_LENS: Lens = "insights";

const LENSES: readonly Lens[] = ["books", "highlights", "insights"];

export const DEFAULT_VIEW_STATE: ViewState = {
  lens: DEFAULT_LENS,
  q: "",
  bookId: null,
  highlightId: null,
  insightId: null,
  drawerId: null,
  showHidden: false,
  filter: EMPTY_FILTER,
};

/** Restores a view from `?lens=&q=&book=&highlight=&insight=&drawer=&hidden=&filter=`. Unknown input is ignored. */
export function parseViewState(search: string): ViewState {
  const params = new URLSearchParams(search);
  const lensParam = params.get("lens");
  const lens = LENSES.includes(lensParam as Lens)
    ? (lensParam as Lens)
    : DEFAULT_LENS;
  return {
    lens,
    q: params.get("q") ?? "",
    bookId: params.get("book") || null,
    highlightId: params.get("highlight") || null,
    insightId: params.get("insight") || null,
    drawerId: params.get("drawer") || null,
    showHidden: params.get("hidden") === "1",
    filter: parseFilter(params.get("filter"), lens),
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
  if (state.drawerId) params.set("drawer", state.drawerId);
  if (state.showHidden) params.set("hidden", "1");
  const filter = serializeFilter(state.lens, state.filter);
  if (filter) params.set("filter", filter);
  return params.toString();
}
