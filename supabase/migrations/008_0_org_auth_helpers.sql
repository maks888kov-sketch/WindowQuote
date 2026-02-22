-- Org auth helpers: ensure has_org_role and is_member_of_org exist before 009.
-- Runs after 007, before 008. Uses org_members (001) and role type (001).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'role') then
    create type role as enum ('admin', 'manager', 'measurer', 'worker');
  end if;
exception
  when duplicate_object then null;
end
$$;

create or replace function public.is_member_of_org(org_id uuid)
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

grant execute on function public.is_member_of_org(uuid) to authenticated;
grant execute on function public.is_member_of_org(uuid) to service_role;

create or replace function public.has_org_role(org_id uuid, allowed_roles role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from org_members
    where org_members.org_id = has_org_role.org_id
      and org_members.user_id = auth.uid()
      and org_members.role = any(allowed_roles)
  );
$$;

grant execute on function public.has_org_role(uuid, role[]) to authenticated;
grant execute on function public.has_org_role(uuid, role[]) to service_role;
