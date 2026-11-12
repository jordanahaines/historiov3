/**
 * Historio v3 Drizzle schema. Everything lives in the Postgres schema `v3` —
 * the app never touches `public` (the old Historio tables) or any other schema
 * except reading `auth.users` for the profiles FK.
 *
 * Naming: snake_case in Postgres (first arg to each column builder), camelCase
 * at the TypeScript boundary (the property name).
 *
 * Authorization is application code (lib/authz/), not RLS: Drizzle connects as
 * the table owner and bypasses RLS. RLS is still enabled on every table, with
 * no policies, as a deny-by-default backstop.
 */
import { sql } from "drizzle-orm";
import {
  check,
  customType,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgSchema,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

export const v3 = pgSchema("v3");

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** id + created/updated. Not used by `profiles`, whose id comes from auth.users. */
function baseColumns() {
  return {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  };
}

/**
 * PostGIS geometry(Geometry, 4326): a point (the common case) or a polygon /
 * multipolygon (an Area insight). Drizzle's built-in `geometry` only models
 * points, hence the custom type. The driver value is hex EWKB, so don't read
 * this column raw — select `ST_AsGeoJSON(location)` in lib/authz/ queries, and
 * write with `ST_SetSRID(ST_GeomFromGeoJSON(...), 4326)`.
 */
const geometry4326 = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geometry(Geometry, 4326)";
  },
});

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Where highlights come from. Add `readwise` here in E1.5. */
export const importSourceEnum = v3.enum("import_source", ["kindle_scribe"]);

export const ingestionStatusEnum = v3.enum("ingestion_status", [
  "received",
  "processing",
  "completed",
  "failed",
]);

export const highlightStatusEnum = v3.enum("highlight_status", [
  "pending", // saved, awaiting the Contextualizer
  "discarded", // Contextualizer: not groundable in a real time/place
  "contextualized", // enriched, awaiting the Researchers
  "researched", // Researchers have run (possibly producing nothing)
  "failed",
]);

export const noteOriginEnum = v3.enum("note_origin", ["typed", "handwritten"]);

export const insightTypeEnum = v3.enum("insight_type", [
  "event",
  "person",
  "place",
  "concept",
]);

export const insightStatusEnum = v3.enum("insight_status", [
  "published", // default — visible on the Library Map/Timeline
  "hidden", // dismissed by the user
]);

// ---------------------------------------------------------------------------
// profiles — mirrors auth.users; row created by a Supabase-side trigger
// (see drizzle/0002_*.sql), which also generates inbound_token.
// ---------------------------------------------------------------------------

export const profiles = v3
  .table("profiles", {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    // Random lowercase-hex secret; the user's inbound address is
    // <inbound_token>@<INBOUND_EMAIL_DOMAIN> (a Resend receiving domain, where
    // any local part is accepted).
    inboundToken: text("inbound_token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  })
  .enableRLS();

// ---------------------------------------------------------------------------
// books — shared catalog (not user-owned)
// ---------------------------------------------------------------------------

export const books = v3
  .table("books", {
    ...baseColumns(),
    title: text("title").notNull(),
    author: text("author"),
    // Amazon id; the primary match key for Kindle imports.
    asin: text("asin").unique(),
    isbn: text("isbn"),
    coverImageUrl: text("cover_image_url"),
  })
  .enableRLS();

// ---------------------------------------------------------------------------
// user_books — a user's library. Nothing is shown unless a row exists here.
// ---------------------------------------------------------------------------

export const userBooks = v3
  .table(
    "user_books",
    {
      ...baseColumns(),
      userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
      bookId: uuid("book_id")
        .notNull()
        .references(() => books.id, { onDelete: "cascade" }),
    },
    (t) => [
      unique("user_books_user_book_unique").on(t.userId, t.bookId),
      index("user_books_book_id_idx").on(t.bookId),
    ],
  )
  .enableRLS();

// ---------------------------------------------------------------------------
// ingestion_events — one row per inbound email / import run
// ---------------------------------------------------------------------------

export const ingestionEvents = v3
  .table(
    "ingestion_events",
    {
      ...baseColumns(),
      userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
      source: importSourceEnum("source").notNull(),
      status: ingestionStatusEnum("status").notNull().default("received"),
      // Resend's email id — unique, so webhook retries are idempotent.
      resendEmailId: text("resend_email_id").unique(),
      fromAddress: text("from_address"),
      subject: text("subject"),
      // Supabase Storage path of the original attachment (the notebook PDF).
      attachmentPath: text("attachment_path"),
      bookId: uuid("book_id").references(() => books.id, {
        onDelete: "set null",
      }),
      highlightsFound: integer("highlights_found").notNull().default(0),
      highlightsNew: integer("highlights_new").notNull().default(0),
      error: text("error"),
      completedAt: timestamp("completed_at", { withTimezone: true }),
    },
    (t) => [index("ingestion_events_user_id_idx").on(t.userId, t.createdAt)],
  )
  .enableRLS();

// ---------------------------------------------------------------------------
// highlights — a user's raw highlights plus their pipeline state
// ---------------------------------------------------------------------------

export const highlights = v3
  .table(
    "highlights",
    {
      ...baseColumns(),
      userId: uuid("user_id").notNull(),
      bookId: uuid("book_id").notNull(),
      ingestionEventId: uuid("ingestion_event_id").references(
        () => ingestionEvents.id,
        { onDelete: "set null" },
      ),
      source: importSourceEnum("source").notNull(),
      // Source-specific dedup key (computed by the ingestion adapter).
      externalId: text("external_id").notNull(),
      page: integer("page"),
      chapter: text("chapter"),
      highlightedText: text("highlighted_text").notNull(),
      noteText: text("note_text"),
      noteOrigin: noteOriginEnum("note_origin"),
      // Supabase Storage path of a handwritten note's scan.
      noteImagePath: text("note_image_path"),
      // When the reader made the highlight — not a historical date.
      annotatedAt: timestamp("annotated_at", { withTimezone: true }),
      status: highlightStatusEnum("status").notNull().default("pending"),
      // Contextualizer output: context when kept, discardReason when not.
      context: text("context"),
      discardReason: text("discard_reason"),
      researchedAt: timestamp("researched_at", { withTimezone: true }),
    },
    (t) => [
      // A highlight can only belong to a book in the user's library.
      foreignKey({
        name: "highlights_user_book_fk",
        columns: [t.userId, t.bookId],
        foreignColumns: [userBooks.userId, userBooks.bookId],
      }).onDelete("cascade"),
      unique("highlights_dedup_unique").on(
        t.userId,
        t.bookId,
        t.source,
        t.externalId,
      ),
      index("highlights_status_idx").on(t.status),
      index("highlights_book_id_idx").on(t.bookId),
    ],
  )
  .enableRLS();

// ---------------------------------------------------------------------------
// insights — a user's historical things, with a Period and an optional Area
// ---------------------------------------------------------------------------

/**
 * Generated numeric positions on one axis, for indexed range-overlap filtering
 * (the integer parts stay the source of truth). Astronomical years (1 BCE = 0,
 * 2 BCE = -1) so BCE sorts correctly.
 *
 * Start = the beginning of the date's precision unit; end = the *end* of it, so
 * "April 1912" spans [1912.25, 1912.333) and an end of just "1912" means the
 * end of 1912. That keeps end >= start for any valid Period, and a missing
 * ends_* means the period is the start's own precision unit.
 */
const startValue = (y: string, m: string, d: string) =>
  `(${y}::double precision + (coalesce(${m}, 1) - 1) / 12.0 + (coalesce(${d}, 1) - 1) / 372.0)`;

const endValue = (y: string, m: string, d: string) =>
  `(CASE WHEN ${m} IS NULL THEN ${y} + 1.0 WHEN ${d} IS NULL THEN ${y} + ${m} / 12.0 ELSE ${y} + (${m} - 1) / 12.0 + ${d} / 372.0 END)`;

export const insights = v3
  .table(
    "insights",
    {
      ...baseColumns(),
      userId: uuid("user_id")
        .notNull()
        .references(() => profiles.id, { onDelete: "cascade" }),
      type: insightTypeEnum("type").notNull(),
      status: insightStatusEnum("status").notNull().default("published"),
      title: text("title").notNull(),
      // Alternate titles seen across merged highlights — improves matching.
      aliases: text("aliases")
        .array()
        .notNull()
        .default(sql`ARRAY[]::text[]`),
      // Synthesized from insight_highlights.contribution (regenerated, never
      // patched in place).
      description: text("description"),
      // Period. Null ends_* = the period is just the start's own precision unit.
      startsYear: integer("starts_year").notNull(),
      startsMonth: smallint("starts_month"),
      startsDay: smallint("starts_day"),
      endsYear: integer("ends_year"),
      endsMonth: smallint("ends_month"),
      endsDay: smallint("ends_day"),
      startsValue: doublePrecision("starts_value").generatedAlwaysAs(
        sql.raw(startValue("starts_year", "starts_month", "starts_day")),
      ),
      endsValue: doublePrecision("ends_value").generatedAlwaysAs(
        sql.raw(
          `CASE WHEN ends_year IS NULL THEN ${endValue("starts_year", "starts_month", "starts_day")} ELSE ${endValue("ends_year", "ends_month", "ends_day")} END`,
        ),
      ),
      // Area: point or polygon, SRID 4326. Null = not placeable on the map.
      location: geometry4326("location"),
      locationName: text("location_name"),
      lastEnrichedAt: timestamp("last_enriched_at", { withTimezone: true }),
    },
    (t) => [
      check("insights_period_ordered", sql`${t.endsValue} >= ${t.startsValue}`),
      index("insights_user_status_idx").on(t.userId, t.status),
      index("insights_period_idx").on(t.startsValue, t.endsValue),
      index("insights_location_gist_idx").using("gist", t.location),
      index("insights_title_trgm_idx").using("gin", t.title.op("gin_trgm_ops")),
    ],
  )
  .enableRLS();

// ---------------------------------------------------------------------------
// insight_highlights — lineage, plus what each highlight contributed.
// An insight's books are derived through here: highlights -> books.
// ---------------------------------------------------------------------------

export const insightHighlights = v3
  .table(
    "insight_highlights",
    {
      ...baseColumns(),
      insightId: uuid("insight_id")
        .notNull()
        .references(() => insights.id, { onDelete: "cascade" }),
      highlightId: uuid("highlight_id")
        .notNull()
        .references(() => highlights.id, { onDelete: "cascade" }),
      // What this highlight's candidate said, unmerged. The insight's
      // description is regenerated from all of these, so merges are idempotent
      // and reversible (delete the link, regenerate).
      contribution: text("contribution").notNull(),
    },
    (t) => [
      unique("insight_highlights_unique").on(t.insightId, t.highlightId),
      index("insight_highlights_highlight_id_idx").on(t.highlightId),
    ],
  )
  .enableRLS();
