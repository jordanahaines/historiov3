-- Keeps v3.profiles in sync with auth.users (Supabase Auth's own schema).
-- Named distinctly from the old app's public.handle_new_user trigger, which
-- still exists on auth.users; the two coexist and both fire on signup.
--
-- inbound_token: 32 lowercase hex chars (122 random bits) — email local parts
-- aren't reliably case-preserved, so no mixed case.
create or replace function v3.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = v3, pg_temp
as $$
begin
  insert into v3.profiles (id, display_name, inbound_token)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    replace(gen_random_uuid()::text, '-', '')
  );
  return new;
end;
$$;
--> statement-breakpoint
drop trigger if exists v3_on_auth_user_created on auth.users;
--> statement-breakpoint
create trigger v3_on_auth_user_created
  after insert on auth.users
  for each row execute function v3.handle_new_user();
--> statement-breakpoint
-- The Data API is disabled and the app uses the table-owning role, so the
-- public-facing roles should have no access to v3 at all (defense in depth).
revoke all on schema v3 from anon, authenticated;
--> statement-breakpoint
revoke all on all tables in schema v3 from anon, authenticated;
--> statement-breakpoint
alter default privileges in schema v3 revoke all on tables from anon, authenticated;
