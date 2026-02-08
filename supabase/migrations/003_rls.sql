alter table orgs enable row level security;
alter table profiles enable row level security;
alter table org_members enable row level security;
alter table customers enable row level security;
alter table sites enable row level security;
alter table orders enable row level security;
alter table order_status_history enable row level security;
alter table measurements enable row level security;
alter table measurement_items enable row level security;
alter table attachments enable row level security;
alter table measurement_item_attachments enable row level security;

create policy "orgs_select" on orgs
  for select
  using (is_member_of_org(id));

create policy "orgs_update" on orgs
  for update
  using (is_org_admin(id));

create policy "orgs_delete" on orgs
  for delete
  using (is_org_admin(id));

create policy "profiles_select" on profiles
  for select
  using (is_member_of_org(org_id));

create policy "profiles_insert" on profiles
  for insert
  with check (is_member_of_org(org_id) and auth.uid() = user_id);

create policy "profiles_update" on profiles
  for update
  using (is_member_of_org(org_id) and auth.uid() = user_id)
  with check (is_member_of_org(org_id) and auth.uid() = user_id);

create policy "profiles_delete" on profiles
  for delete
  using (is_org_admin(org_id));

create policy "org_members_select" on org_members
  for select
  using (is_member_of_org(org_id));

create policy "org_members_insert" on org_members
  for insert
  with check (is_org_admin(org_id));

create policy "org_members_update" on org_members
  for update
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));

create policy "org_members_delete" on org_members
  for delete
  using (is_org_admin(org_id));

create policy "customers_select" on customers
  for select
  using (is_member_of_org(org_id));

create policy "customers_insert" on customers
  for insert
  with check (is_member_of_org(org_id));

create policy "customers_update" on customers
  for update
  using (is_member_of_org(org_id))
  with check (is_member_of_org(org_id));

create policy "customers_delete" on customers
  for delete
  using (is_member_of_org(org_id));

create policy "sites_select" on sites
  for select
  using (is_member_of_org(org_id));

create policy "sites_insert" on sites
  for insert
  with check (is_member_of_org(org_id));

create policy "sites_update" on sites
  for update
  using (is_member_of_org(org_id))
  with check (is_member_of_org(org_id));

create policy "sites_delete" on sites
  for delete
  using (is_member_of_org(org_id));

create policy "orders_select" on orders
  for select
  using (is_member_of_org(org_id));

create policy "orders_insert" on orders
  for insert
  with check (is_member_of_org(org_id));

create policy "orders_update" on orders
  for update
  using (is_member_of_org(org_id))
  with check (is_member_of_org(org_id));

create policy "orders_delete" on orders
  for delete
  using (is_member_of_org(org_id));

create policy "order_status_history_select" on order_status_history
  for select
  using (is_member_of_org(org_id));

create policy "order_status_history_insert" on order_status_history
  for insert
  with check (is_member_of_org(org_id));

create policy "measurements_select" on measurements
  for select
  using (is_member_of_org(org_id));

create policy "measurements_insert" on measurements
  for insert
  with check (is_member_of_org(org_id));

create policy "measurement_items_select" on measurement_items
  for select
  using (is_member_of_org(org_id));

create policy "measurement_items_insert" on measurement_items
  for insert
  with check (is_member_of_org(org_id));

create policy "attachments_select" on attachments
  for select
  using (is_member_of_org(org_id));

create policy "attachments_insert" on attachments
  for insert
  with check (is_member_of_org(org_id));

create policy "measurement_item_attachments_select" on measurement_item_attachments
  for select
  using (is_member_of_org(org_id));

create policy "measurement_item_attachments_insert" on measurement_item_attachments
  for insert
  with check (is_member_of_org(org_id));
