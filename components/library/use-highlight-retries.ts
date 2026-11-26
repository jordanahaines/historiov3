import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { LibraryActions } from "@/components/library/library-actions";
import { canRetryHighlight, isTerminalStatus } from "@/lib/library/retry";
import type {
  HighlightStatus,
  LibraryData,
  LibraryHighlight,
} from "@/lib/library/types";

export const RETRY_POLL_INTERVAL_MS = 5_000;
export const RETRY_POLL_LIMIT_MS = 5 * 60_000;
const CLOCK_TICK_MS = 30_000;

export type HighlightRetryState = {
  canRetry: boolean;
  retrying: boolean;
  error?: string;
  onRetry: () => void;
};

type Options = {
  actions: LibraryActions;
  onStatus: (id: string, status: HighlightStatus, updatedAt: string) => void;
  onRefresh: (data: LibraryData) => void;
};

function subscribeToClock(onTick: () => void) {
  const timer = setInterval(onTick, CLOCK_TICK_MS);
  return () => clearInterval(timer);
}

const readClock = () => Math.floor(Date.now() / CLOCK_TICK_MS) * CLOCK_TICK_MS;
const noClock = () => null;

/**
 * Retry for stuck highlights: sends the request, then polls each accepted one
 * until it reaches a terminal status (and reloads the library data) or the
 * polling limit passes.
 */
export function useHighlightRetries({ actions, onStatus, onRefresh }: Options) {
  const now = useSyncExternalStore(subscribeToClock, readClock, noClock);
  // Highlight id -> when the server accepted it (null while the request is out).
  const [retrying, setRetrying] = useState<Record<string, number | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Guards a second click that lands before the state above has re-rendered.
  const requested = useRef(new Set<string>());

  function finish(id: string) {
    requested.current.delete(id);
    setRetrying((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)),
    );
  }

  async function reload(): Promise<boolean> {
    const result = await actions.refreshLibrary().catch(() => null);
    if (!result?.ok) return false;
    onRefresh(result.data);
    return true;
  }

  async function retry(id: string) {
    if (requested.current.has(id)) return;
    requested.current.add(id);
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)),
    );
    setRetrying((current) => ({ ...current, [id]: null }));

    const result = await actions.retryHighlight(id).catch(() => null);
    if (result?.ok) {
      onStatus(id, result.status, result.updatedAt);
      setRetrying((current) => ({ ...current, [id]: Date.now() }));
      return;
    }
    const message = result?.error ?? "Couldn't start the retry. Try again.";
    setErrors((current) => ({ ...current, [id]: message }));
    finish(id);
    // A refusal usually means this page is out of date.
    if (result) await reload();
  }

  const poll = useEffectEvent(async () => {
    for (const [id, acceptedAt] of Object.entries(retrying)) {
      if (acceptedAt === null) continue;
      const result = await actions.getHighlightStatus(id).catch(() => null);
      if (result?.ok) {
        onStatus(id, result.status, result.updatedAt);
        if (isTerminalStatus(result.status) && (await reload())) {
          finish(id);
          continue;
        }
      }
      if (Date.now() - acceptedAt >= RETRY_POLL_LIMIT_MS) finish(id);
    }
  });

  const polling = Object.keys(retrying).length > 0;
  useEffect(() => {
    if (!polling) return;
    let busy = false;
    const timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        await poll();
      } finally {
        busy = false;
      }
    }, RETRY_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [polling]);

  return function retryStateFor(
    highlight: LibraryHighlight,
  ): HighlightRetryState {
    return {
      canRetry: canRetryHighlight(highlight, now),
      retrying: highlight.id in retrying,
      error: errors[highlight.id],
      onRetry: () => void retry(highlight.id),
    };
  };
}
