/**
 * The viewer's whole library in one load: books, highlights and insights with
 * the relations the Library UI needs. Counts and dates are computed here in
 * SQL. Removed books (`user_books.status = 'removed'`) never appear, nor do
 * their highlights. Insights are listed regardless of book status for now.
 */
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import type {
  HighlightStatus,
  InsightStatus,
  InsightType,
  LibraryBook,
  LibraryData,
  LibraryHighlight,
  LibraryInsight,
} from "@/lib/library/types";

const ISO = (column: string) =>
  `to_char(${column} at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;

async function loadBooks(viewerId: string): Promise<LibraryBook[]> {
  const rows = await db.execute<{
    id: string;
    title: string;
    author: string | null;
    cover_image_url: string | null;
    last_highlight_at: string | null;
    highlight_count: number;
    insight_count: number;
  }>(sql`
    select b.id, b.title, b.author, b.cover_image_url,
      (select ${sql.raw(ISO("max(coalesce(h.annotated_at, h.created_at))"))}
         from v3.highlights h
         where h.user_id = ub.user_id and h.book_id = b.id) as last_highlight_at,
      (select count(*)::int from v3.highlights h
         where h.user_id = ub.user_id and h.book_id = b.id) as highlight_count,
      (select count(distinct i.id)::int
         from v3.highlights h
         join v3.insight_highlights ih on ih.highlight_id = h.id
         join v3.insights i on i.id = ih.insight_id and i.status = 'published'
         where h.user_id = ub.user_id and h.book_id = b.id) as insight_count
    from v3.user_books ub
    join v3.books b on b.id = ub.book_id
    where ub.user_id = ${viewerId} and ub.status = 'active'
  `);
  return Array.from(rows).map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author,
    coverImageUrl: row.cover_image_url,
    lastHighlightAt: row.last_highlight_at,
    highlightCount: row.highlight_count,
    insightCount: row.insight_count,
  }));
}

async function loadHighlights(viewerId: string): Promise<LibraryHighlight[]> {
  const rows = await db.execute<{
    id: string;
    book_id: string;
    highlighted_text: string;
    note_text: string | null;
    has_note_image: boolean;
    page: number | null;
    status: HighlightStatus;
    captured_at: string;
    updated_at: string;
    insights: { id: string; title: string }[];
  }>(sql`
    select h.id, h.book_id, h.highlighted_text, h.note_text,
      (h.note_image_path is not null) as has_note_image, h.page, h.status,
      ${sql.raw(ISO("coalesce(h.annotated_at, h.created_at)"))} as captured_at,
      ${sql.raw(ISO("h.updated_at"))} as updated_at,
      coalesce((
        select json_agg(json_build_object('id', i.id, 'title', i.title) order by i.title)
        from v3.insight_highlights ih
        join v3.insights i on i.id = ih.insight_id
          and i.status = 'published' and i.user_id = h.user_id
        where ih.highlight_id = h.id
      ), '[]'::json) as insights
    from v3.highlights h
    join v3.user_books ub
      on ub.user_id = h.user_id and ub.book_id = h.book_id and ub.status = 'active'
    where h.user_id = ${viewerId}
  `);
  return Array.from(rows).map((row) => ({
    id: row.id,
    bookId: row.book_id,
    text: row.highlighted_text,
    noteText: row.note_text,
    hasNoteImage: row.has_note_image,
    page: row.page,
    status: row.status,
    capturedAt: row.captured_at,
    updatedAt: row.updated_at,
    insights: row.insights,
  }));
}

async function loadInsights(viewerId: string): Promise<LibraryInsight[]> {
  const rows = await db.execute<{
    id: string;
    type: InsightType;
    status: InsightStatus;
    title: string;
    aliases: string[];
    description: string | null;
    location_name: string | null;
    starts_year: number;
    starts_month: number | null;
    starts_day: number | null;
    ends_year: number | null;
    ends_month: number | null;
    ends_day: number | null;
    highlight_count: number;
    highlight_ids: string[];
    book_ids: string[];
  }>(sql`
    with links as (
      select ih.insight_id, h.id as highlight_id, h.book_id
      from v3.insight_highlights ih
      join v3.highlights h on h.id = ih.highlight_id and h.user_id = ${viewerId}
      join v3.user_books ub
        on ub.user_id = h.user_id and ub.book_id = h.book_id and ub.status = 'active'
    )
    select i.id, i.type, i.status, i.title, to_json(i.aliases) as aliases,
      i.description, i.location_name,
      i.starts_year, i.starts_month, i.starts_day,
      i.ends_year, i.ends_month, i.ends_day,
      count(distinct l.highlight_id)::int as highlight_count,
      coalesce(json_agg(distinct l.highlight_id) filter (where l.highlight_id is not null), '[]'::json) as highlight_ids,
      coalesce(json_agg(distinct l.book_id) filter (where l.book_id is not null), '[]'::json) as book_ids
    from v3.insights i
    left join links l on l.insight_id = i.id
    where i.user_id = ${viewerId}
    group by i.id
  `);
  return Array.from(rows).map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    title: row.title,
    aliases: row.aliases,
    description: row.description,
    locationName: row.location_name,
    period: {
      startsYear: row.starts_year,
      startsMonth: row.starts_month,
      startsDay: row.starts_day,
      endsYear: row.ends_year,
      endsMonth: row.ends_month,
      endsDay: row.ends_day,
    },
    highlightCount: row.highlight_count,
    highlightIds: row.highlight_ids,
    bookIds: row.book_ids,
  }));
}

export async function getLibrary(viewerId: string): Promise<LibraryData> {
  const [books, highlights, insights] = await Promise.all([
    loadBooks(viewerId),
    loadHighlights(viewerId),
    loadInsights(viewerId),
  ]);
  return { books, highlights, insights };
}
