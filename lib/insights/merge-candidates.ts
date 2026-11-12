/**
 * Merge-and-enrich: turns a highlight's researcher candidates into insights.
 *
 * For each candidate: shortlist the user's existing insights, ask the Matcher
 * whether one is the same real-world thing, then either create a new insight
 * or enrich the match (add the highlight's contribution, add the title as an
 * alias, regenerate the description from all contributions). Everything for a
 * highlight — insights, links, and the highlight's `researched` status —
 * commits in one transaction under a per-user advisory lock, so a replayed
 * step is a no-op and parallel highlights can't both create the same insight.
 */
import {
  resolveMatch,
  type InsightMatcherInput,
  type InsightMatcherResult,
} from "@/lib/ai/agents/insight-matcher";
import type {
  InsightSynthesizerInput,
  InsightSynthesizerResult,
} from "@/lib/ai/agents/insight-synthesizer";
import {
  applyInsightEnrichment,
  createInsight,
  getHighlightOwner,
  getHighlightToResearch,
  getInsightForEnrichment,
  linkHighlightToInsight,
  listInsightContributions,
  markHighlightResearched,
  shortlistInsightCandidates,
  withUserInsightLock,
} from "@/lib/authz/insights";
import {
  contributionOf,
  normalizeCandidate,
  type NormalizedCandidate,
  type TypedCandidate,
} from "@/lib/insights/candidate";
import { describePeriod } from "@/lib/insights/period";

export type MergeDeps = {
  judge: (input: InsightMatcherInput) => Promise<InsightMatcherResult>;
  synthesize: (
    input: InsightSynthesizerInput,
  ) => Promise<InsightSynthesizerResult>;
};

export type MergeOutcome = {
  /** True when the highlight was already researched (or discarded): nothing done. */
  skipped: boolean;
  created: number;
  enriched: number;
  /** Candidates that resolved to an insight this highlight already feeds. */
  alreadyLinked: number;
};

export async function mergeCandidatesForHighlight(
  highlightId: string,
  candidates: TypedCandidate[],
  deps: MergeDeps,
): Promise<MergeOutcome> {
  const userId = await getHighlightOwner(highlightId);
  if (!userId) throw new Error(`Highlight ${highlightId} not found`);

  return withUserInsightLock(userId, async (tx) => {
    // Re-checked inside the lock: a concurrent or replayed run may have
    // finished this highlight while we waited.
    const highlight = await getHighlightToResearch(tx, highlightId);
    if (!highlight) {
      return { skipped: true, created: 0, enriched: 0, alreadyLinked: 0 };
    }

    const outcome: MergeOutcome = {
      skipped: false,
      created: 0,
      enriched: 0,
      alreadyLinked: 0,
    };

    for (const raw of candidates) {
      const candidate = normalizeCandidate(raw);
      const contribution = contributionOf(candidate);
      const shortlist = await shortlistInsightCandidates(tx, userId, candidate);

      const matchedId = await findMatch(candidate, shortlist, deps);

      if (!matchedId) {
        const insightId = await createInsight(tx, userId, candidate);
        await linkHighlightToInsight(tx, {
          insightId,
          highlightId,
          contribution,
        });
        outcome.created += 1;
        continue;
      }

      const linked = await linkHighlightToInsight(tx, {
        insightId: matchedId,
        highlightId,
        contribution,
      });
      if (!linked) {
        outcome.alreadyLinked += 1;
        continue;
      }

      const insight = await getInsightForEnrichment(tx, matchedId);
      if (!insight) throw new Error(`Insight ${matchedId} not found`);
      const contributions = await listInsightContributions(tx, matchedId);
      const description =
        contributions.length === 1
          ? contributions[0]
          : (
              await deps.synthesize({
                title: insight.title,
                type: insight.type,
                contributions,
              })
            ).description;
      await applyInsightEnrichment(tx, matchedId, {
        description,
        newTitle: candidate.title,
      });
      outcome.enriched += 1;
    }

    await markHighlightResearched(tx, highlightId);
    return outcome;
  });
}

/**
 * Asks the Matcher about the shortlist. Any failure of the judge (after the
 * SDK's own retries) is treated as "no match": a duplicate is cheaper than a
 * wrong merge, and one flaky call shouldn't fail the whole highlight.
 */
async function findMatch(
  candidate: NormalizedCandidate,
  shortlist: Awaited<ReturnType<typeof shortlistInsightCandidates>>,
  deps: MergeDeps,
): Promise<string | null> {
  if (shortlist.length === 0) return null;
  try {
    const result = await deps.judge({
      candidate: {
        type: candidate.type,
        title: candidate.title,
        description: candidate.description,
        period: describePeriod(candidate.period),
        locationHint: candidate.point
          ? `${candidate.point.lat.toFixed(2)}, ${candidate.point.lng.toFixed(2)}`
          : null,
      },
      options: shortlist.map((option) => ({
        title: option.title,
        aliases: option.aliases,
        description: option.description,
        period: describePeriod({
          startsYear: option.startsYear,
          startsMonth: option.startsMonth,
          startsDay: option.startsDay,
          endsYear: option.endsYear,
          endsMonth: option.endsMonth,
          endsDay: option.endsDay,
        }),
        locationName: option.locationName,
      })),
    });
    const index = resolveMatch(result, shortlist.length);
    return index === null ? null : shortlist[index].id;
  } catch (error) {
    console.warn("Insight matcher failed; creating a new insight", error);
    return null;
  }
}
