import type { HighlightRetryState } from "@/components/library/use-highlight-retries";
import type { HighlightStatus } from "@/lib/library/types";

type RetryHighlightProps = {
  status: HighlightStatus;
  retry: HighlightRetryState;
  variant: "row" | "drawer";
};

/**
 * The Retry control for a failed or stalled highlight, its Retrying… state and
 * any error. Renders nothing for a highlight that has none of those.
 */
export function RetryHighlight({
  status,
  retry,
  variant,
}: RetryHighlightProps) {
  const { canRetry, retrying, error, onRetry } = retry;
  if (!canRetry && !retrying && !error) return null;

  const explanation =
    status === "failed"
      ? "Processing hit an error. Retrying picks up where it stopped."
      : "This looks stuck. Retrying picks up where it stopped.";
  const label = variant === "drawer" ? "Retry processing" : "Retry";

  return (
    <div aria-live="polite" className="flex flex-col items-start gap-1">
      {variant === "drawer" && canRetry && !retrying ? (
        <p className="text-ink-muted text-xs">{explanation}</p>
      ) : null}
      {retrying ? (
        <span className="text-ink-muted text-[13px]">Retrying…</span>
      ) : canRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-link focus-visible:outline-link text-[13px] font-medium hover:underline focus-visible:outline-2"
        >
          {label}
        </button>
      ) : null}
      {error && !retrying ? (
        <p className="text-type-event text-xs">{error}</p>
      ) : null}
    </div>
  );
}
