"use server";

import { start } from "workflow/api";
import { z } from "zod";

import type {
  ActionResult,
  HighlightStatusResult,
  NoteUrlResult,
  RefreshLibraryResult,
} from "@/components/library/library-actions";
import {
  claimHighlightRetryForViewer,
  getHighlightStatusForViewer,
  getNoteImagePathForViewer,
  releaseHighlightRetry,
} from "@/lib/authz/highlights";
import { setInsightStatusForViewer } from "@/lib/authz/insights";
import { getLibrary } from "@/lib/authz/library";
import { getViewer } from "@/lib/authz/viewer";
import { createNoteScanSignedUrl } from "@/lib/storage/buckets";
import { processHighlightWorkflow } from "@/lib/workflows/process-highlight";

const idSchema = z.uuid();
const NOT_SIGNED_IN = "You're not signed in.";
const HIGHLIGHT_NOT_FOUND = "Highlight not found.";

async function changeStatus(
  insightId: string,
  status: "published" | "hidden",
): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: NOT_SIGNED_IN };
  const id = idSchema.safeParse(insightId);
  if (!id.success) return { ok: false, error: "Insight not found." };

  const changed = await setInsightStatusForViewer(viewer.id, id.data, status);
  return changed ? { ok: true } : { ok: false, error: "Insight not found." };
}

export async function hideInsightAction(
  insightId: string,
): Promise<ActionResult> {
  return changeStatus(insightId, "hidden");
}

export async function restoreInsightAction(
  insightId: string,
): Promise<ActionResult> {
  return changeStatus(insightId, "published");
}

/** A short-lived signed URL for the viewer's own handwritten-note scan. */
export async function getNoteImageUrlAction(
  highlightId: string,
): Promise<NoteUrlResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: NOT_SIGNED_IN };
  const id = idSchema.safeParse(highlightId);
  if (!id.success) return { ok: false, error: "Note not found." };

  const path = await getNoteImagePathForViewer(viewer.id, id.data);
  if (!path) return { ok: false, error: "Note not found." };
  try {
    return { ok: true, url: await createNoteScanSignedUrl(path) };
  } catch {
    return { ok: false, error: "Couldn't load the note image." };
  }
}

/** Re-runs the pipeline for one of the viewer's failed or stalled highlights. */
export async function retryHighlightAction(
  highlightId: string,
): Promise<HighlightStatusResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: NOT_SIGNED_IN };
  const id = idSchema.safeParse(highlightId);
  if (!id.success) return { ok: false, error: HIGHLIGHT_NOT_FOUND };

  const claim = await claimHighlightRetryForViewer(viewer.id, id.data);
  if (claim.outcome === "not_found") {
    return { ok: false, error: HIGHLIGHT_NOT_FOUND };
  }
  if (claim.outcome === "not_retryable") {
    return { ok: false, error: "This highlight can't be retried right now." };
  }

  try {
    await start(processHighlightWorkflow, [id.data]);
  } catch (error) {
    console.error(`Couldn't start a retry for highlight ${id.data}`, error);
    await releaseHighlightRetry(id.data, claim);
    return { ok: false, error: "Couldn't start the retry. Try again." };
  }
  return {
    ok: true,
    status: claim.status,
    updatedAt: claim.updatedAt.toISOString(),
  };
}

export async function getHighlightStatusAction(
  highlightId: string,
): Promise<HighlightStatusResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: NOT_SIGNED_IN };
  const id = idSchema.safeParse(highlightId);
  if (!id.success) return { ok: false, error: HIGHLIGHT_NOT_FOUND };

  const row = await getHighlightStatusForViewer(viewer.id, id.data);
  if (!row) return { ok: false, error: HIGHLIGHT_NOT_FOUND };
  return {
    ok: true,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The viewer's library as it stands, after a retried highlight finishes. */
export async function refreshLibraryAction(): Promise<RefreshLibraryResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: NOT_SIGNED_IN };
  return { ok: true, data: await getLibrary(viewer.id) };
}
