import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz/viewer", () => ({ getViewer: vi.fn() }));
vi.mock("@/lib/authz/insights", () => ({ setInsightStatusForViewer: vi.fn() }));
vi.mock("@/lib/authz/highlights", () => ({
  claimHighlightRetryForViewer: vi.fn(),
  getHighlightStatusForViewer: vi.fn(),
  getNoteImagePathForViewer: vi.fn(),
  releaseHighlightRetry: vi.fn(),
}));
vi.mock("@/lib/authz/library", () => ({ getLibrary: vi.fn() }));
vi.mock("workflow/api", () => ({ start: vi.fn() }));
vi.mock("@/lib/workflows/process-highlight", () => ({
  processHighlightWorkflow: vi.fn(),
}));
vi.mock("@/lib/storage/buckets", () => ({ createNoteScanSignedUrl: vi.fn() }));

import { start } from "workflow/api";

import {
  claimHighlightRetryForViewer,
  getHighlightStatusForViewer,
  getNoteImagePathForViewer,
  releaseHighlightRetry,
} from "@/lib/authz/highlights";
import { setInsightStatusForViewer } from "@/lib/authz/insights";
import { getViewer } from "@/lib/authz/viewer";
import { createNoteScanSignedUrl } from "@/lib/storage/buckets";
import { processHighlightWorkflow } from "@/lib/workflows/process-highlight";

import {
  getHighlightStatusAction,
  getNoteImageUrlAction,
  hideInsightAction,
  refreshLibraryAction,
  restoreInsightAction,
  retryHighlightAction,
} from "./actions";

const ID = "6f1f3f0e-5f0e-4b1e-9a55-0d6f3c3a1a11";
const viewer = { id: "3b9d6c1e-2a47-4f3b-8c15-7e0a9d4b5f62", displayName: "T" };

beforeEach(() => vi.resetAllMocks());

describe("hide / restore", () => {
  it("refuses without a viewer, touching nothing", async () => {
    vi.mocked(getViewer).mockResolvedValue(null);
    expect((await hideInsightAction(ID)).ok).toBe(false);
    expect(setInsightStatusForViewer).not.toHaveBeenCalled();
  });

  it("rejects a malformed id", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer);
    expect((await hideInsightAction("nope")).ok).toBe(false);
    expect(setInsightStatusForViewer).not.toHaveBeenCalled();
  });

  it("scopes the write to the viewer", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer);
    vi.mocked(setInsightStatusForViewer).mockResolvedValue(true);
    expect(await hideInsightAction(ID)).toEqual({ ok: true });
    expect(setInsightStatusForViewer).toHaveBeenCalledWith(
      viewer.id,
      ID,
      "hidden",
    );
    await restoreInsightAction(ID);
    expect(setInsightStatusForViewer).toHaveBeenLastCalledWith(
      viewer.id,
      ID,
      "published",
    );
  });

  it("reports not found when the insight isn't the viewer's", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer);
    vi.mocked(setInsightStatusForViewer).mockResolvedValue(false);
    expect((await hideInsightAction(ID)).ok).toBe(false);
  });
});

describe("getNoteImageUrlAction", () => {
  it("refuses without a viewer", async () => {
    vi.mocked(getViewer).mockResolvedValue(null);
    expect((await getNoteImageUrlAction(ID)).ok).toBe(false);
    expect(createNoteScanSignedUrl).not.toHaveBeenCalled();
  });

  it("signs nothing when the viewer doesn't own the note", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer);
    vi.mocked(getNoteImagePathForViewer).mockResolvedValue(null);
    expect((await getNoteImageUrlAction(ID)).ok).toBe(false);
    expect(createNoteScanSignedUrl).not.toHaveBeenCalled();
  });

  it("returns a signed url for the owner", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer);
    vi.mocked(getNoteImagePathForViewer).mockResolvedValue("u/note.png");
    vi.mocked(createNoteScanSignedUrl).mockResolvedValue("https://signed");
    expect(await getNoteImageUrlAction(ID)).toEqual({
      ok: true,
      url: "https://signed",
    });
    expect(getNoteImagePathForViewer).toHaveBeenCalledWith(viewer.id, ID);
  });
});

describe("retry a highlight", () => {
  const claim = {
    outcome: "started" as const,
    previousStatus: "failed" as const,
    status: "pending" as const,
    updatedAt: new Date("2026-11-25T12:00:00Z"),
  };

  it("refuses without a viewer", async () => {
    vi.mocked(getViewer).mockResolvedValue(null);
    expect((await retryHighlightAction(ID)).ok).toBe(false);
    expect((await getHighlightStatusAction(ID)).ok).toBe(false);
    expect((await refreshLibraryAction()).ok).toBe(false);
    expect(claimHighlightRetryForViewer).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it("rejects a malformed id", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer);
    expect((await retryHighlightAction("nope")).ok).toBe(false);
    expect(claimHighlightRetryForViewer).not.toHaveBeenCalled();
  });

  it("claims for the viewer and starts one workflow", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer);
    vi.mocked(claimHighlightRetryForViewer).mockResolvedValue(claim);
    expect(await retryHighlightAction(ID)).toEqual({
      ok: true,
      status: "pending",
      updatedAt: "2026-11-25T12:00:00.000Z",
    });
    expect(claimHighlightRetryForViewer).toHaveBeenCalledWith(viewer.id, ID);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(processHighlightWorkflow, [ID]);
  });

  it.each(["not_found", "not_retryable"] as const)(
    "starts nothing when the claim is %s",
    async (outcome) => {
      vi.mocked(getViewer).mockResolvedValue(viewer);
      vi.mocked(claimHighlightRetryForViewer).mockResolvedValue({ outcome });
      expect((await retryHighlightAction(ID)).ok).toBe(false);
      expect(start).not.toHaveBeenCalled();
    },
  );

  it("releases the claim when the workflow can't start", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getViewer).mockResolvedValue(viewer);
    vi.mocked(claimHighlightRetryForViewer).mockResolvedValue(claim);
    vi.mocked(start).mockRejectedValue(new Error("down"));
    expect((await retryHighlightAction(ID)).ok).toBe(false);
    expect(releaseHighlightRetry).toHaveBeenCalledWith(ID, claim);
  });

  it("reads status as the viewer", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer);
    vi.mocked(getHighlightStatusForViewer).mockResolvedValue(null);
    expect((await getHighlightStatusAction(ID)).ok).toBe(false);
    expect(getHighlightStatusForViewer).toHaveBeenCalledWith(viewer.id, ID);
  });
});
