create extension if not exists "pgcrypto";

create type role as enum ('admin', 'manager', 'measurer', 'worker');
create type order_status as enum (
  'draft',
  'quoted',
  'approved',
  'scheduled',
  'completed',
  'canceled'
);
create type item_type as enum ('window', 'door', 'hardware', 'glass', 'other');

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role role not null default 'worker',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
  title text not null,
  status order_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table measurements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  version integer not null,
  created_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, version)
);

create table measurement_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  measurement_id uuid not null references measurements(id) on delete cascade,
  item_type item_type not null,
  width numeric(10, 2),
  height numeric(10, 2),
  quantity integer not null default 1,
  params_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  measurement_id uuid references measurements(id) on delete set null,
  path text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table measurement_item_attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  measurement_item_id uuid not null references measurement_items(id) on delete cascade,
  attachment_id uuid not null references attachments(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (measurement_item_id, attachment_id)
);

create index idx_profiles_org_id on profiles(org_id);
create index idx_profiles_user_id on profiles(user_id);
create index idx_org_members_org_id on org_members(org_id);
create index idx_org_members_user_id on org_members(user_id);
create index idx_customers_org_id on customers(org_id);
create index idx_sites_org_id on sites(org_id);
create index idx_sites_customer_id on sites(customer_id);
create index idx_orders_org_id on orders(org_id);
create index idx_orders_customer_id on orders(customer_id);
create index idx_orders_site_id on orders(site_id);
create index idx_order_status_history_org_id on order_status_history(org_id);
create index idx_order_status_history_order_id on order_status_history(order_id);
create index idx_measurements_org_id on measurements(org_id);
create index idx_measurements_order_id on measurements(order_id);
create index idx_measurement_items_org_id on measurement_items(org_id);
create index idx_measurement_items_measurement_id on measurement_items(measurement_id);
create index idx_attachments_org_id on attachments(org_id);
create index idx_attachments_order_id on attachments(order_id);
create index idx_attachments_measurement_id on attachments(measurement_id);
create index idx_measurement_item_attachments_org_id on measurement_item_attachments(org_id);
create index idx_measurement_item_attachments_measurement_item_id on measurement_item_attachments(measurement_item_id);

create trigger set_orgs_updated_at
before update on orgs
for each row execute function set_updated_at();

create trigger set_profiles_updated_at
before update on profiles
for each row execute function set_updated_at();

create trigger set_org_members_updated_at
before update on org_members
for each row execute function set_updated_at();

create trigger set_customers_updated_at
before update on customers
for each row execute function set_updated_at();

create trigger set_sites_updated_at
before update on sites
for each row execute function set_updated_at();

create trigger set_orders_updated_at
before update on orders
for each row execute function set_updated_at();

create trigger set_order_status_history_updated_at
before update on order_status_history
for each row execute function set_updated_at();

create trigger set_measurements_updated_at
before update on measurements
for each row execute function set_updated_at();

create trigger set_measurement_items_updated_at
before update on measurement_items
for each row execute function set_updated_at();

create trigger set_attachments_updated_at
before update on attachments
for each row execute function set_updated_at();

create trigger set_measurement_item_attachments_updated_at
before update on measurement_item_attachments
for each row execute function set_updated_at();
