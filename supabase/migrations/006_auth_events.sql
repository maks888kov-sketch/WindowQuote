create table if not exists auth_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_events_org_created_at
  on auth_events(org_id, created_at desc);

create index if not exists idx_auth_events_user_created_at
  on auth_events(user_id, created_at desc);

alter table auth_events enable row level security;

create policy "auth_events_select" on auth_events
  for select
  using (is_member_of_org(org_id));

create or replace function log_auth_event(p_org_id uuid, p_event text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not is_member_of_org(p_org_id) then
    raise exception 'Not a member of this organization';
  end if;

  insert into auth_events (org_id, user_id, event)
  values (p_org_id, auth.uid(), p_event)
  returning id into inserted_id;

  return inserted_id;
end;
$$;

grant execute on function log_auth_event(uuid, text) to authenticated;
