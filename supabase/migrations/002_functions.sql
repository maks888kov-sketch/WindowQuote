create or replace function create_org(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into orgs (name)
  values (org_name)
  returning id into new_org_id;

  insert into org_members (org_id, user_id, role)
  values (new_org_id, auth.uid(), 'admin');

  return new_org_id;
end;
$$;

grant execute on function create_org(text) to authenticated;

create or replace function is_member_of_org(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from org_members
    where org_members.org_id = is_member_of_org.org_id
      and org_members.user_id = auth.uid()
  );
$$;

create or replace function is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from org_members
    where org_members.org_id = is_org_admin.org_id
      and org_members.user_id = auth.uid()
      and org_members.role = 'admin'
  );
$$;
