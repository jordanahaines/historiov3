import type { IngestEmailInput } from "@/lib/inbound/handle-inbound-email";

import {
  completeIngestion,
  failIngestion,
  importNotebook,
  startHighlightWorkflows,
  storeAttachments,
  type ImportSummary,
} from "./steps/ingest-steps";

export type IngestEmailResult = {
  ingestionEventId: string;
  highlightWorkflowsStarted: number;
};

export type IngestSteps = {
  storeAttachments: (input: IngestEmailInput) => Promise<string[]>;
  importNotebook: (input: {
    ingestionEventId: string;
    userId: string;
    attachmentPath: string;
  }) => Promise<ImportSummary>;
  startHighlightWorkflows: (ingestionEventId: string) => Promise<number>;
  completeIngestion: (input: {
    ingestionEventId: string;
    summaries: ImportSummary[];
  }) => Promise<void>;
  failIngestion: (input: {
    ingestionEventId: string;
    message: string;
  }) => Promise<void>;
};

export const defaultIngestSteps: IngestSteps = {
  storeAttachments,
  importNotebook,
  startHighlightWorkflows,
  completeIngestion,
  failIngestion,
};

/**
 * Durable import for one inbound email: store the PDF(s), import each
 * notebook, then start a per-highlight workflow for every new highlight. Any
 * failure that survives the runtime's retries marks the ingestion event
 * `failed` with a readable error.
 *
 * Start with `start(ingestEmailWorkflow, [input])` from `workflow/api`.
 */
export async function ingestEmailWorkflow(
  input: IngestEmailInput,
): Promise<IngestEmailResult> {
  "use workflow";

  return orchestrateIngest(input, defaultIngestSteps);
}

/**
 * The import's sequencing, with steps injectable for tests. Runs in the
 * Workflow sandbox — pure orchestration only.
 */
export async function orchestrateIngest(
  input: IngestEmailInput,
  steps: IngestSteps,
): Promise<IngestEmailResult> {
  try {
    const paths = await steps.storeAttachments(input);

    const summaries: ImportSummary[] = [];
    for (const attachmentPath of paths) {
      summaries.push(
        await steps.importNotebook({
          ingestionEventId: input.ingestionEventId,
          userId: input.userId,
          attachmentPath,
        }),
      );
    }

    const started = await steps.startHighlightWorkflows(input.ingestionEventId);
    await steps.completeIngestion({
      ingestionEventId: input.ingestionEventId,
      summaries,
    });
    return {
      ingestionEventId: input.ingestionEventId,
      highlightWorkflowsStarted: started,
    };
  } catch (error) {
    await steps.failIngestion({
      ingestionEventId: input.ingestionEventId,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
