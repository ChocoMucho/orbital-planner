create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  payload jsonb not null,
  schema_version integer not null default 1 check (schema_version > 0),
  game_data_version text not null,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plans_owner_updated_idx
  on public.plans (owner_id, updated_at desc);

alter table public.plans enable row level security;

create policy "plans_select_own"
  on public.plans for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "plans_insert_own"
  on public.plans for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "plans_update_own"
  on public.plans for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "plans_delete_own"
  on public.plans for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.touch_plan_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.revision = old.revision + 1;
  return new;
end;
$$;

drop trigger if exists plans_touch_revision on public.plans;
create trigger plans_touch_revision
before update on public.plans
for each row execute function public.touch_plan_revision();
