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
  // A refusal's message goes away once a reload shows the highlight moved on.
  if (!canRetry && !retrying) return null;

  const explanation =
    status === "failed"
      ? "Processing hit an error. Retrying picks up where it stopped."
      : "This looks stuck. Retrying picks up where it stopped.";
  const label = variant === "drawer" ? "Retry processing" : "Retry";

  return (
    <div aria-live="polite" className="flex flex-col items-start gap-1">
      {variant === "drawer" && !retrying ? (
        <p className="text-ink-muted text-xs">{explanation}</p>
      ) : null}
      {/* One button for both states, so keyboard focus stays on it. */}
      <button
        type="button"
        aria-disabled={retrying || undefined}
        onClick={retrying ? undefined : onRetry}
        className={`focus-visible:outline-link text-[13px] focus-visible:outline-2 ${
          retrying
            ? "text-ink-muted cursor-default"
            : "text-link font-medium hover:underline"
        }`}
      >
        {retrying ? "Retrying…" : label}
      </button>
      {error && !retrying ? (
        <p className="text-type-event text-xs">{error}</p>
      ) : null}
    </div>
  );
}
