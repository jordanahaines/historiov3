import { z } from "zod";

// Shared by every Researcher: they all propose the same shape of candidate
// Insight, differing only in what they look for. startsYear is the only
// required date field; an empty `candidates` array is a valid result.
const month = z.number().int().min(1).max(12).nullable();
const day = z.number().int().min(1).max(31).nullable();

export const candidateSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  startsYear: z.number().int(),
  startsMonth: month,
  startsDay: day,
  endsYear: z.number().int().nullable(),
  endsMonth: month,
  endsDay: day,
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});

export const researcherSchema = z.object({
  candidates: z.array(candidateSchema),
});

export type ResearcherCandidate = z.infer<typeof candidateSchema>;
export type ResearcherResult = z.infer<typeof researcherSchema>;
