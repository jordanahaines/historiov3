import * as personResearcher from "@/lib/ai/agents/person-researcher";
import type { TypedCandidate } from "@/lib/insights/candidate";

import { researchHighlight } from "./research-highlight";

export async function runPersonResearcher(
  highlightId: string,
): Promise<TypedCandidate[]> {
  "use step";

  return researchHighlight({
    highlightId,
    type: "person",
    agent: personResearcher,
  });
}
