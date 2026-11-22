/**
 * Who is looking at the app. This is the ONLY place pages, Server Actions and
 * Route Handlers learn the viewer's id; nothing else may read a user id from a
 * request.
 *
 * Interim implementation: there is no real sign-in yet, so the viewer is
 * forced to the user named by the FORCED_VIEWER_ID env var. It refuses to work
 * on the production deployment, so a forced user's data can never be shown
 * there. Real sign-in (Supabase Auth) replaces `resolveViewer`'s body and adds
 * the sign-in page and sign-out; call sites don't change.
 */
import { redirect } from "next/navigation";
import { z } from "zod";

import { getViewerProfile, type ViewerProfile } from "@/lib/authz/profiles";

export type Viewer = ViewerProfile;

type ResolveDeps = {
  forcedId: string | undefined;
  vercelEnv: string | undefined;
  nodeEnv?: string | undefined;
  loadProfile: (id: string) => Promise<ViewerProfile | null>;
};

let warnedAboutProduction = false;

/** Exported for tests; the app uses getViewer / requireViewer. */
export async function resolveViewer(deps: ResolveDeps): Promise<Viewer | null> {
  // Fail closed: allowed only on a Vercel preview/development deploy, or
  // locally (no VERCEL_ENV and not a production build).
  const allowed =
    deps.vercelEnv === "preview" ||
    deps.vercelEnv === "development" ||
    (deps.vercelEnv === undefined && deps.nodeEnv !== "production");
  if (!allowed) {
    if (!warnedAboutProduction) {
      warnedAboutProduction = true;
      console.error(
        "FORCED_VIEWER_ID is ignored outside local and preview: real sign-in is not implemented yet, so there is no viewer.",
      );
    }
    return null;
  }
  const parsed = z.uuid().safeParse(deps.forcedId);
  if (!parsed.success) return null;
  return deps.loadProfile(parsed.data);
}

export function getViewer(): Promise<Viewer | null> {
  return resolveViewer({
    forcedId: process.env.FORCED_VIEWER_ID,
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
    loadProfile: getViewerProfile,
  });
}

/** For pages and layouts: no viewer means /sign-in. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  return viewer;
}

/** Test hook: lets the once-only production warning fire again. */
export function resetViewerWarningForTests(): void {
  warnedAboutProduction = false;
}
