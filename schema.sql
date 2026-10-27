-- Monarchs Empire: run this entire script in Supabase SQL Editor for a fresh project.
-- This starter intentionally gives newly registered users the "member" role only.
-- Never let a client update its own role. Grant owner/moderator roles manually from the SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 2 and 20),
  display_name text not null check (char_length(display_name) between 1 and 28),
  avatar_url text,
  banner_url text,
  avatar_effect text not null default 'aura' check (avatar_effect in ('aura','royal','ember','ice','none')),
  role text not null default 'member' check (role in ('member','moderator','owner')),
  status text not null default 'Awakened',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null default 'general' check (room_id in ('general','introductions','media','announcements')),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  unique(message_id, user_id, emoji)
);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null default 'Reported from chat',
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','reviewed','dismissed'))
);

create index if not exists messages_room_created_idx on public.messages(room_id, created_at);
create index if not exists messages_user_idx on public.messages(user_id);
create index if not exists reports_status_idx on public.message_reports(status, created_at);

alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_reports enable row level security;

-- Helper functions run as SECURITY DEFINER to avoid recursive RLS policies.
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_moderator_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('moderator','owner'), false)
$$;

grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_moderator_or_owner() to authenticated;

-- Profiles: users can read profile cards, create their own member profile, and edit their own public details.
drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
create policy "Profiles are readable by authenticated users"
on public.profiles for select to authenticated using (true);

drop policy if exists "Users create own member profile" on public.profiles;
create policy "Users create own member profile"
on public.profiles for insert to authenticated
with check (id = auth.uid() and role = 'member');

drop policy if exists "Users update own profile but not role" on public.profiles;
create policy "Users update own profile but not role"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = public.current_profile_role());

-- Messages: members may read non-deleted messages and create messages as themselves.
drop policy if exists "Read messages" on public.messages;
create policy "Read messages"
on public.messages for select to authenticated
using (deleted_at is null or public.is_moderator_or_owner());

drop policy if exists "Insert own messages" on public.messages;
create policy "Insert own messages"
on public.messages for insert to authenticated
with check (user_id = auth.uid() and deleted_at is null);

drop policy if exists "Edit own messages" on public.messages;
create policy "Edit own messages"
on public.messages for update to authenticated
using (user_id = auth.uid() or public.is_moderator_or_owner())
with check (
  (user_id = auth.uid() and public.current_profile_role() = (select p.role from public.profiles p where p.id = auth.uid()))
  or public.is_moderator_or_owner()
);

-- Reactions: users can manage their own reaction rows.
drop policy if exists "Read reactions" on public.message_reactions;
create policy "Read reactions" on public.message_reactions for select to authenticated using (true);
drop policy if exists "Insert own reactions" on public.message_reactions;
create policy "Insert own reactions" on public.message_reactions for insert to authenticated
with check (user_id = auth.uid());
drop policy if exists "Delete own reactions" on public.message_reactions;
create policy "Delete own reactions" on public.message_reactions for delete to authenticated
using (user_id = auth.uid());

-- Reports: members can submit reports; only moderators/owners can read or update them.
drop policy if exists "Users submit reports" on public.message_reports;
create policy "Users submit reports" on public.message_reports for insert to authenticated
with check (reporter_id = auth.uid());
drop policy if exists "Moderators view reports" on public.message_reports;
create policy "Moderators view reports" on public.message_reports for select to authenticated
using (public.is_moderator_or_owner());
drop policy if exists "Moderators update reports" on public.message_reports;
create policy "Moderators update reports" on public.message_reports for update to authenticated
using (public.is_moderator_or_owner()) with check (public.is_moderator_or_owner());

-- Enable Realtime for message INSERT/UPDATE/DELETE events.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
when undefined_object then raise notice 'Publication supabase_realtime not found; enable Realtime for messages in the dashboard.';
end $$;

-- After the first account is created, grant the owner role manually with this query,
-- replacing the username. Do not add an owner switch to the frontend:
-- update public.profiles set role = 'owner' where username = 'YOUR_USERNAME';
