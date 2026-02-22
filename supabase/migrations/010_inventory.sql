-- Inventory (optional per plan)
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  code text,
  name text not null,
  unit text not null default 'pcs',
  quantity numeric(12, 2) not null default 0,
  min_quantity numeric(12, 2) default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventory_items_org_id on inventory_items(org_id);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('in', 'out', 'adjust', 'reserve', 'release')),
  quantity numeric(12, 2) not null,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_movements_org_id on inventory_movements(org_id);
create index if not exists idx_inventory_movements_item_id on inventory_movements(inventory_item_id);

create trigger set_inventory_items_updated_at before update on inventory_items for each row execute function set_updated_at();

alter table inventory_items enable row level security;
alter table inventory_movements enable row level security;

create policy "inventory_items_select" on inventory_items for select using (is_member_of_org(org_id));
create policy "inventory_items_insert" on inventory_items for insert with check (has_org_role(org_id, array['admin', 'manager']::role[]));
create policy "inventory_items_update" on inventory_items for update using (has_org_role(org_id, array['admin', 'manager']::role[])) with check (has_org_role(org_id, array['admin', 'manager']::role[]));
create policy "inventory_items_delete" on inventory_items for delete using (has_org_role(org_id, array['admin']::role[]));

create policy "inventory_movements_select" on inventory_movements for select using (is_member_of_org(org_id));
create policy "inventory_movements_insert" on inventory_movements for insert with check (has_org_role(org_id, array['admin', 'manager']::role[]));
