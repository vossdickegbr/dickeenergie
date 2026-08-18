-- 1. Create the two users in Supabase Authentication first.
-- 2. Replace the UUIDs below with the auth.users IDs.
-- 3. Run this once in the SQL editor.

insert into public.team_profiles (profile_id, auth_user_id, display_name)
values
  ('voss',  '00000000-0000-0000-0000-000000000001', 'Herr Voss'),
  ('dicke', '00000000-0000-0000-0000-000000000002', 'Herr Dicke')
on conflict (profile_id) do update
set auth_user_id = excluded.auth_user_id,
    display_name = excluded.display_name,
    active = true;
