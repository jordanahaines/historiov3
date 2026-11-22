import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authz/viewer", () => ({ getViewer: vi.fn() }));
vi.mock("@/lib/authz/insights", () => ({ setInsightStatusForViewer: vi.fn() }));
vi.mock("@/lib/authz/highlights", () => ({
  getNoteImagePathForViewer: vi.fn(),
}));
vi.mock("@/lib/storage/buckets", () => ({ createNoteScanSignedUrl: vi.fn() }));

import { getNoteImagePathForViewer } from "@/lib/authz/highlights";
import { setInsightStatusForViewer } from "@/lib/authz/insights";
import { getViewer } from "@/lib/authz/viewer";
import { createNoteScanSignedUrl } from "@/lib/storage/buckets";

import {
  getNoteImageUrlAction,
  hideInsightAction,
  restoreInsightAction,
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
