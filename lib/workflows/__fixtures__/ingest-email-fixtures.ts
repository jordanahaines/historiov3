/**
 * Test-only variants of ingestEmailWorkflow with fake steps (see
 * process-highlight-fixtures.ts for why).
 */
import { orchestrateIngest, type IngestSteps } from "../ingest-email";

async function storeAttachments(): Promise<string[]> {
  "use step";
  return ["u/ev/0.pdf"];
}
async function noPdf(): Promise<string[]> {
  "use step";
  const { FatalError } = await import("workflow");
  throw new FatalError("The email has no PDF attachment");
}
async function importNotebook() {
  "use step";
  return { bookId: "book-1", highlightsFound: 4 };
}
async function startHighlightWorkflows(): Promise<number> {
  "use step";
  return 4;
}
async function completeIngestion(): Promise<void> {
  "use step";
}
async function failIngestion(): Promise<void> {
  "use step";
}

const base: IngestSteps = {
  storeAttachments,
  importNotebook,
  startHighlightWorkflows,
  completeIngestion,
  failIngestion,
};

const input = (id: string) => ({
  ingestionEventId: id,
  userId: "u1",
  resendEmailId: "re1",
  attachments: [],
});

export async function happyIngestWorkflow(id: string) {
  "use workflow";
  return orchestrateIngest(input(id), base);
}

export async function noPdfIngestWorkflow(id: string) {
  "use workflow";
  return orchestrateIngest(input(id), { ...base, storeAttachments: noPdf });
}
