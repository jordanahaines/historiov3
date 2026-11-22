import { redirect } from "next/navigation";

import { getViewer } from "@/lib/authz/viewer";

/** The marketing landing page is a later story; for now `/` just routes. */
export default async function HomePage() {
  const viewer = await getViewer();
  redirect(viewer ? "/library" : "/sign-in");
}
