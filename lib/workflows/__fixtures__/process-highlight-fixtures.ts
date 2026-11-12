/**
 * Test-only variants of processHighlightWorkflow with fake steps. The real
 * steps read and write the database and call models, which the Workflow test
 * runtime can't reach through vi.mock, so orchestration (branching, fan-out,
 * failure handling) is exercised here with step functions that only record
 * what ran. Real step behavior is covered by the unit and integration tests.
 * Nothing under app/ imports this file, so it never lands in the build.
 */
import type { TypedCandidate } from "@/lib/insights/candidate";

import {
  orchestrateHighlight,
  type HighlightSteps,
} from "../process-highlight";

const candidate = (
  type: "event" | "person",
  title: string,
): TypedCandidate => ({
  type,
  title,
  description: null,
  startsYear: 1900,
  startsMonth: null,
  startsDay: null,
  endsYear: null,
  endsMonth: null,
  endsDay: null,
  lat: null,
  lng: null,
});

async function keep(): Promise<{ discarded: boolean }> {
  "use step";
  return { discarded: false };
}
async function discard(): Promise<{ discarded: boolean }> {
  "use step";
  return { discarded: true };
}
async function explode(): Promise<{ discarded: boolean }> {
  "use step";
  const { FatalError } = await import("workflow");
  throw new FatalError("boom");
}
async function runEventResearcher(): Promise<TypedCandidate[]> {
  "use step";
  return [candidate("event", "Battle of Ur")];
}
async function runPersonResearcher(): Promise<TypedCandidate[]> {
  "use step";
  return [candidate("person", "Shulgi")];
}
async function mergeHighlightInsights(
  _id: string,
  candidates: TypedCandidate[],
) {
  "use step";
  return {
    skipped: false,
    created: candidates.length,
    enriched: 0,
    alreadyLinked: 0,
  };
}
async function failHighlight(): Promise<void> {
  "use step";
}

function steps(contextualize: HighlightSteps["contextualize"]): HighlightSteps {
  return {
    contextualize,
    researchers: { event: runEventResearcher, person: runPersonResearcher },
    merge: mergeHighlightInsights,
    fail: failHighlight,
  };
}

export async function keptHighlightWorkflow(highlightId: string) {
  "use workflow";
  return orchestrateHighlight(highlightId, steps(keep));
}

export async function discardedHighlightWorkflow(highlightId: string) {
  "use workflow";
  return orchestrateHighlight(highlightId, steps(discard));
}

export async function failingHighlightWorkflow(highlightId: string) {
  "use workflow";
  return orchestrateHighlight(highlightId, steps(explode));
}
