import { LibraryView } from "@/components/library/LibraryView";
import { getLibrary } from "@/lib/authz/library";
import { requireViewer } from "@/lib/authz/viewer";

import {
  getNoteImageUrlAction,
  hideInsightAction,
  restoreInsightAction,
} from "./actions";

type LibraryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const viewer = await requireViewer();
  const [data, params] = await Promise.all([
    getLibrary(viewer.id),
    searchParams,
  ]);

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) search.set(key, first);
  }

  return (
    <LibraryView
      data={data}
      initialSearch={search.toString()}
      actions={{
        hideInsight: hideInsightAction,
        restoreInsight: restoreInsightAction,
        getNoteImageUrl: getNoteImageUrlAction,
      }}
    />
  );
}
