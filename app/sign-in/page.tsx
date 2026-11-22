import { redirect } from "next/navigation";

import { getViewer } from "@/lib/authz/viewer";

/** Placeholder: real sign-in is a later story. No form, no credentials. */
export default async function SignInPage() {
  const viewer = await getViewer();
  if (viewer) redirect("/library");

  return (
    <main className="mx-auto w-full max-w-[780px] px-6 py-24">
      <h1 className="font-serif text-4xl font-bold">Historio</h1>
      <p className="mt-6 font-serif text-xl">
        Sign-in isn&apos;t available yet.
      </p>
      <p className="text-ink-secondary mt-3 text-sm">
        This build uses a fixed test user when{" "}
        <code className="text-ink font-mono">FORCED_VIEWER_ID</code> is set.
      </p>
    </main>
  );
}
