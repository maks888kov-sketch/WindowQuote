create index if not exists idx_orders_org_created_at on orders(org_id, created_at);
create index if not exists idx_orders_org_status_created_at on orders(org_id, status, created_at);
create index if not exists idx_measurements_order_version on measurements(order_id, version);
create index if not exists idx_measurement_items_org_measurement on measurement_items(org_id, measurement_id);
create index if not exists idx_attachments_org_id on attachments(org_id);

create or replace function deny_update_delete_measurements()
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
for each row execute function deny_update_delete_measurements();

drop policy if exists "measurement_items_insert" on measurement_items;
drop policy if exists "measurement_items_update" on measurement_items;
drop policy if exists "measurement_items_delete" on measurement_items;

drop policy if exists "attachments_insert" on attachments;
drop policy if exists "attachments_update" on attachments;
drop policy if exists "attachments_delete" on attachments;

drop policy if exists "measurement_item_attachments_insert" on measurement_item_attachments;
drop policy if exists "measurement_item_attachments_update" on measurement_item_attachments;
drop policy if exists "measurement_item_attachments_delete" on measurement_item_attachments;

create policy "measurement_items_insert" on measurement_items
  for insert
  with check (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]));

create policy "measurement_items_update" on measurement_items
  for update
  using (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]))
  with check (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]));

create policy "measurement_items_delete" on measurement_items
  for delete
  using (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]));

create policy "attachments_insert" on attachments
  for insert
  with check (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]));

create policy "attachments_update" on attachments
  for update
  using (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]))
  with check (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]));

create policy "attachments_delete" on attachments
  for delete
  using (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]));

create policy "measurement_item_attachments_insert" on measurement_item_attachments
  for insert
  with check (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]));

create policy "measurement_item_attachments_update" on measurement_item_attachments
  for update
  using (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]))
  with check (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]));

create policy "measurement_item_attachments_delete" on measurement_item_attachments
  for delete
  using (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]));

drop policy if exists "photos_select" on storage.objects;
drop policy if exists "photos_insert" on storage.objects;
drop policy if exists "photos_update" on storage.objects;
drop policy if exists "photos_delete" on storage.objects;

create policy "photos_select" on storage.objects
  for select
  using (
    bucket_id = 'photos'
    and split_part(name, '/', 1) = 'orgs'
    and is_member_of_org((split_part(name, '/', 2))::uuid)
  );

create policy "photos_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'photos'
    and split_part(name, '/', 1) = 'orgs'
    and is_member_of_org((split_part(name, '/', 2))::uuid)
  );

create policy "photos_delete" on storage.objects
  for delete
  using (
    bucket_id = 'photos'
    and split_part(name, '/', 1) = 'orgs'
    and is_member_of_org((split_part(name, '/', 2))::uuid)
  );

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

  select org_id
    into v_org_id
  from orders
  where id = create_measurement_version.order_id
  for update;

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
