import type { ReactNode } from "react";

import { TopNav } from "@/components/shell/TopNav";
import { requireViewer } from "@/lib/authz/viewer";

/** Every page under (app) is guarded: no viewer redirects to /sign-in. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  const initial = viewer.displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <>
      <TopNav initial={initial} />
      <div className="flex-1">{children}</div>
    </>
  );
}
