create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  start_date date null,
  end_date date null,
  base_currency char(3) not null check (base_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  members_changed_at timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date)
);

create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('organizer', 'participant')),
  status text not null check (status in ('active', 'left', 'removed')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id),
  check (role <> 'organizer' or status = 'active')
);

create unique index trip_members_one_organizer on public.trip_members (trip_id)
  where role = 'organizer';

-- The primary key serves lookups by trip; "My trips" and the RLS helpers look up by user.
create index trip_members_user_id on public.trip_members (user_id);

create table public.invitations (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.invitations enable row level security;

-- Supabase default privileges give clients everything on new tables, so start from nothing.
-- All writes go through functions; select policies are added by the next migration.
revoke all on table public.trips from public, anon, authenticated;
revoke all on table public.trip_members from public, anon, authenticated;
revoke all on table public.invitations from public, anon, authenticated;
grant select on table public.trips to authenticated;
grant select on table public.trip_members to authenticated;
grant select on table public.invitations to authenticated;

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

create trigger trip_members_set_updated_at
  before update on public.trip_members
  for each row execute function public.set_updated_at();
