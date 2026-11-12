/**
 * Storage helpers for the Scribe pipeline. Per CLAUDE.md, supabase-js is
 * scoped to Auth/Storage only — nothing here touches the database.
 *
 * Uses the secret key: these run as unattended jobs with no signed-in user,
 * and both buckets are private with no policies (deny-all for everyone else).
 */
import { createClient } from "@supabase/supabase-js";

export const INGESTION_ATTACHMENTS_BUCKET = "ingestion-attachments";
export const NOTE_SCANS_BUCKET = "note-scans";

function storageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

async function upload(
  bucket: string,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  // upsert so a retried step can re-upload without failing.
  const { error } = await storageClient()
    .storage.from(bucket)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) {
    throw new Error(`Failed to upload ${bucket}/${path}: ${error.message}`, {
      cause: error,
    });
  }
  return path;
}

/** Stores an emailed notebook PDF; returns its path within the bucket. */
export function uploadIngestionAttachment(
  userId: string,
  ingestionEventId: string,
  index: number,
  bytes: Uint8Array,
): Promise<string> {
  return upload(
    INGESTION_ATTACHMENTS_BUCKET,
    `${userId}/${ingestionEventId}/${index}.pdf`,
    bytes,
    "application/pdf",
  );
}

export async function downloadIngestionAttachment(
  path: string,
): Promise<Uint8Array> {
  const { data, error } = await storageClient()
    .storage.from(INGESTION_ATTACHMENTS_BUCKET)
    .download(path);
  if (error || !data) {
    throw new Error(
      `Failed to download ${INGESTION_ATTACHMENTS_BUCKET}/${path}: ${error?.message}`,
      { cause: error },
    );
  }
  return new Uint8Array(await data.arrayBuffer());
}

/** Stores a handwritten note's original scan; returns its path. */
export function uploadNoteScan(
  userId: string,
  externalId: string,
  image: Uint8Array,
): Promise<string> {
  return upload(
    NOTE_SCANS_BUCKET,
    `${userId}/${externalId}.png`,
    image,
    "image/png",
  );
}
