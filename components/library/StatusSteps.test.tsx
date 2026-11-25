// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusSteps } from "@/components/library/StatusSteps";
import { highlightStatusSteps } from "@/lib/library/status-label";
import type { HighlightStatus } from "@/lib/library/types";

afterEach(cleanup);

/** The three dot slots, in order. */
function slots(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      "[role=img] > span > span:last-child",
    ),
  );
}

describe("highlightStatusSteps", () => {
  it("marks the active step and the steps passed", () => {
    expect(highlightStatusSteps("pending").steps).toEqual([
      "active",
      "upcoming",
      "upcoming",
    ]);
    expect(highlightStatusSteps("contextualized").steps).toEqual([
      "passed",
      "active",
      "upcoming",
    ]);
    for (const status of ["researched", "failed", "discarded"] as const) {
      expect(highlightStatusSteps(status).steps).toEqual([
        "passed",
        "passed",
        "active",
      ]);
      expect(highlightStatusSteps(status).outcome).toBe(status);
    }
  });
});

describe("StatusSteps", () => {
  const cases: [HighlightStatus, number][] = [
    ["pending", 0],
    ["contextualized", 1],
    ["researched", 2],
    ["failed", 2],
    ["discarded", 2],
  ];

  it.each(cases)(
    "%s: labels the image and puts the tooltip on the active dot only",
    (status, activeIndex) => {
      const { container } = render(<StatusSteps status={status} />);
      const { name, explanation } = highlightStatusSteps(status);
      expect(
        screen.getByRole("img", { name: `${name}: ${explanation}` }),
      ).toBeTruthy();
      const titled = slots(container).map((slot) => slot.getAttribute("title"));
      titled.forEach((title, index) =>
        expect(title).toBe(index === activeIndex ? explanation : null),
      );
    },
  );

  it("draws a green check for researched and a red dot for failed", () => {
    const researched = render(<StatusSteps status="researched" />);
    expect(researched.container.querySelector("svg")).toBeTruthy();
    expect(researched.container.querySelector(".bg-type-place")).toBeTruthy();
    cleanup();
    const failed = render(<StatusSteps status="failed" />);
    expect(failed.container.querySelector("svg")).toBeNull();
    expect(failed.container.querySelector(".bg-type-event")).toBeTruthy();
  });
});
