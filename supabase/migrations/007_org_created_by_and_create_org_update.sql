alter table public.orgs
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists idx_orgs_created_by on public.orgs(created_by);

create or replace function public.create_org(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.orgs (name, created_by)
  values (org_name, current_user_id)
  returning id into new_org_id;

  insert into public.org_members (org_id, user_id, role)
  values (new_org_id, current_user_id, 'admin')
  on conflict (org_id, user_id) do nothing;

  return new_org_id;
end;
$$;

grant execute on function public.create_org(text) to authenticated;
