import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("@/lib/authz/profiles", () => ({ getViewerProfile: vi.fn() }));

import {
  requireViewer,
  resetViewerWarningForTests,
  resolveViewer,
} from "./viewer";
import { getViewerProfile } from "@/lib/authz/profiles";

const ID = "3b9d6c1e-2a47-4f3b-8c15-7e0a9d4b5f62";
const profile = { id: ID, displayName: "Test" };

beforeEach(() => {
  resetViewerWarningForTests();
  vi.restoreAllMocks();
});

describe("resolveViewer", () => {
  it("loads the forced user outside production", async () => {
    const loadProfile = vi.fn().mockResolvedValue(profile);
    const viewer = await resolveViewer({
      forcedId: ID,
      vercelEnv: "preview",
      loadProfile,
    });
    expect(viewer).toEqual(profile);
    expect(loadProfile).toHaveBeenCalledWith(ID);
  });

  it("refuses on production and never loads the profile", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const loadProfile = vi.fn();
    const viewer = await resolveViewer({
      forcedId: ID,
      vercelEnv: "production",
      loadProfile,
    });
    expect(viewer).toBeNull();
    expect(loadProfile).not.toHaveBeenCalled();
    await resolveViewer({ forcedId: ID, vercelEnv: "production", loadProfile });
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("returns null when the id is missing or not a uuid", async () => {
    const loadProfile = vi.fn();
    for (const forcedId of [undefined, "", "not-a-uuid"]) {
      expect(
        await resolveViewer({ forcedId, vercelEnv: undefined, loadProfile }),
      ).toBeNull();
    }
    expect(loadProfile).not.toHaveBeenCalled();
  });

  it("returns null when the forced user has no profile", async () => {
    const viewer = await resolveViewer({
      forcedId: ID,
      vercelEnv: undefined,
      loadProfile: vi.fn().mockResolvedValue(null),
    });
    expect(viewer).toBeNull();
  });
});

describe("requireViewer", () => {
  it("redirects to /sign-in without a viewer", async () => {
    vi.stubEnv("FORCED_VIEWER_ID", "");
    await expect(requireViewer()).rejects.toThrow("REDIRECT:/sign-in");
    vi.unstubAllEnvs();
  });

  it("returns the viewer when one resolves", async () => {
    vi.stubEnv("FORCED_VIEWER_ID", ID);
    vi.stubEnv("VERCEL_ENV", "development");
    vi.mocked(getViewerProfile).mockResolvedValue(profile);
    await expect(requireViewer()).resolves.toEqual(profile);
    vi.unstubAllEnvs();
  });
});
