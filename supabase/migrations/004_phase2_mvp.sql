create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_created_at on orders(created_at);

alter table order_status_history
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null;

alter table order_status_history
  drop column if exists notes,
  drop column if exists updated_at;

drop trigger if exists set_order_status_history_updated_at on order_status_history;

alter table measurement_items
  rename column quantity to qty;

alter table measurement_items
  add column if not exists notes text;

alter table attachments
  drop column if exists order_id,
  drop column if exists measurement_id,
  drop column if exists description,
  drop column if exists updated_at;

alter table attachments
  add column if not exists mime text,
  add column if not exists size bigint,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

drop index if exists idx_attachments_order_id;
drop index if exists idx_attachments_measurement_id;

create or replace function record_order_status_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into order_status_history (org_id, order_id, status, actor_user_id, created_at)
    values (new.org_id, new.id, new.status, auth.uid(), now());
  end if;
  return new;
end;
$$;

drop trigger if exists orders_status_history_trigger on orders;
create trigger orders_status_history_trigger
after insert or update of status on orders
for each row execute function record_order_status_history();

create or replace function prevent_measurement_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Measurements are immutable';
end;
$$;

drop trigger if exists measurements_immutable_trigger on measurements;
create trigger measurements_immutable_trigger
before update or delete on measurements
for each row execute function prevent_measurement_changes();

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

drop policy if exists "photos_select" on storage.objects;
drop policy if exists "photos_insert" on storage.objects;
drop policy if exists "photos_update" on storage.objects;
drop policy if exists "photos_delete" on storage.objects;

create policy "photos_select" on storage.objects
  for select
  using (
    bucket_id = 'photos'
    and is_member_of_org((split_part(name, '/', 1))::uuid)
  );

create policy "photos_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'photos'
    and is_member_of_org((split_part(name, '/', 1))::uuid)
  );

create policy "photos_update" on storage.objects
  for update
  using (
    bucket_id = 'photos'
    and is_member_of_org((split_part(name, '/', 1))::uuid)
  )
  with check (
    bucket_id = 'photos'
    and is_member_of_org((split_part(name, '/', 1))::uuid)
  );

create policy "photos_delete" on storage.objects
  for delete
  using (
    bucket_id = 'photos'
    and is_member_of_org((split_part(name, '/', 1))::uuid)
  );

create or replace function has_org_role(org_id uuid, allowed_roles role[])
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

grant execute on function has_org_role(uuid, role[]) to authenticated;

drop policy if exists "orders_insert" on orders;
drop policy if exists "orders_update" on orders;
drop policy if exists "orders_delete" on orders;

create policy "orders_insert" on orders
  for insert
  with check (has_org_role(org_id, array['admin', 'manager']::role[]));

create policy "orders_update" on orders
  for update
  using (has_org_role(org_id, array['admin', 'manager']::role[]))
  with check (has_org_role(org_id, array['admin', 'manager']::role[]));

create policy "orders_delete" on orders
  for delete
  using (has_org_role(org_id, array['admin', 'manager']::role[]));

drop policy if exists "measurements_insert" on measurements;
drop policy if exists "measurements_update" on measurements;
drop policy if exists "measurements_delete" on measurements;

create policy "measurements_insert" on measurements
  for insert
  with check (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]));

create or replace function create_measurement_version(order_id uuid, note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_measurement_id uuid;
  v_org_id uuid;
  next_version integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select org_id into v_org_id
  from orders
  where id = create_measurement_version.order_id;

  if v_org_id is null then
    raise exception 'Order not found';
  end if;

  if not is_member_of_org(v_org_id) then
    raise exception 'Not authorized';
  end if;

  if not has_org_role(v_org_id, array['admin', 'manager', 'measurer']::role[]) then
    raise exception 'Not authorized';
  end if;

  select coalesce(max(version), 0) + 1
    into next_version
  from measurements
  where order_id = create_measurement_version.order_id;

  insert into measurements (org_id, order_id, version, created_by, notes)
  values (v_org_id, create_measurement_version.order_id, next_version, auth.uid(), note)
  returning id into new_measurement_id;

  return new_measurement_id;
end;
$$;

grant execute on function create_measurement_version(uuid, text) to authenticated;

create or replace function create_attachment_record(
  org_id uuid,
  path text,
  mime text,
  size bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_attachment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not is_member_of_org(create_attachment_record.org_id) then
    raise exception 'Not authorized';
  end if;

  insert into attachments (org_id, path, mime, size, created_by)
  values (
    create_attachment_record.org_id,
    create_attachment_record.path,
    create_attachment_record.mime,
    create_attachment_record.size,
    auth.uid()
  )
  returning id into new_attachment_id;

  return new_attachment_id;
end;
$$;

grant execute on function create_attachment_record(uuid, text, text, bigint) to authenticated;
