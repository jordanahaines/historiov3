-- Users who signed up before v3.handle_new_user existed (e.g. the original
-- Historio account) get a v3 profile and inbound token now.
insert into v3.profiles (id, display_name, inbound_token)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  replace(gen_random_uuid()::text, '-', '')
from auth.users u
on conflict (id) do nothing;
