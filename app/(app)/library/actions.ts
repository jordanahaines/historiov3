"use server";

import { z } from "zod";

import type {
  ActionResult,
  NoteUrlResult,
} from "@/components/library/library-actions";
import { getNoteImagePathForViewer } from "@/lib/authz/highlights";
import { setInsightStatusForViewer } from "@/lib/authz/insights";
import { getViewer } from "@/lib/authz/viewer";
import { createNoteScanSignedUrl } from "@/lib/storage/buckets";

const idSchema = z.uuid();
const NOT_SIGNED_IN = "You're not signed in.";

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
