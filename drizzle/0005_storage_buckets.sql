-- Private Storage buckets for the Scribe email pipeline. No storage.objects
-- policies are added, so only the secret key (server-side ingestion jobs)
-- can read or write; anon/authenticated users get nothing.
insert into storage.buckets (id, name, public)
values
  ('ingestion-attachments', 'ingestion-attachments', false),
  ('note-scans', 'note-scans', false)
on conflict (id) do nothing;
