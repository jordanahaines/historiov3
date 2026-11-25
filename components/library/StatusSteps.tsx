import {
  highlightStatusSteps,
  type StepState,
} from "@/lib/library/status-label";
import type { HighlightStatus } from "@/lib/library/types";

type StatusStepsProps = { status: HighlightStatus };

const DOT: Record<StepState, string> = {
  active: "bg-ink size-2.5 rounded-full",
  passed:
    "bg-border-strong border-border-strong size-2.5 rounded-full border-[1.5px]",
  upcoming: "border-border-strong size-2.5 rounded-full border-[1.5px]",
};

/**
 * A highlight's pipeline status as three connected dots: Pending →
 * Contextualized → outcome (researched = green check, failed = red,
 * discarded = bold). The active dot is bold and carries a tooltip.
 */
export function StatusSteps({ status }: StatusStepsProps) {
  const { steps, outcome, name, explanation } = highlightStatusSteps(status);

  return (
    <span
      role="img"
      aria-label={`${name}: ${explanation}`}
      className="inline-flex items-center"
    >
      {steps.map((step, index) => {
        const last = index === 2;
        const tooltip = step === "active" ? explanation : undefined;
        return (
          <span key={index} className="inline-flex items-center">
            {index > 0 ? (
              <span className="bg-border-strong h-[1.5px] w-3" />
            ) : null}
            <span
              title={tooltip}
              className="flex size-3.5 items-center justify-center"
            >
              {last && step === "active" && outcome === "researched" ? (
                <span className="bg-type-place flex size-3.5 items-center justify-center rounded-full">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-[9px]"
                    fill="none"
                    stroke="white"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12.5l5 5L19 7" />
                  </svg>
                </span>
              ) : last && step === "active" && outcome === "failed" ? (
                <span className="bg-type-event size-2.5 rounded-full" />
              ) : (
                <span className={DOT[step]} />
              )}
            </span>
          </span>
        );
      })}
    </span>
  );
}
