-- Public Storage bucket for book cover images, shared by all users. Public
-- means anyone can read an object by URL; no storage.objects policies are
-- added, so writes still need the secret key (server-side jobs only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-covers',
  'book-covers',
  true,
  5000000,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do nothing;
