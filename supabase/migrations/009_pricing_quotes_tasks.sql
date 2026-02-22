-- Price books (pricelists / brands) per org
create table if not exists price_books (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_price_books_org_id on price_books(org_id);

-- Price items (materials, labor, hardware) within a price book
create table if not exists price_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  price_book_id uuid not null references price_books(id) on delete cascade,
  code text,
  name text not null,
  unit text not null default 'pcs',
  unit_price numeric(12, 2) not null default 0,
  category text,
  item_type item_type,
  params_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_price_items_org_id on price_items(org_id);
create index if not exists idx_price_items_price_book_id on price_items(price_book_id);

-- Pricing rules / formulas (versioned)
create table if not exists pricing_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  price_book_id uuid not null references price_books(id) on delete cascade,
  name text not null,
  rule_type text not null default 'formula',
  rule_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pricing_rules_org_id on pricing_rules(org_id);
create index if not exists idx_pricing_rules_price_book_id on pricing_rules(price_book_id);

-- Pricing versions (snapshot for reproducibility)
create table if not exists pricing_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  price_book_id uuid not null references price_books(id) on delete cascade,
  version integer not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null,
  snapshot_json jsonb,
  unique (price_book_id, version)
);

create index if not exists idx_pricing_versions_org_id on pricing_versions(org_id);
create index if not exists idx_pricing_versions_price_book_id on pricing_versions(price_book_id);

-- Quotes (calculated result per order, linked to measurement + pricing version)
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  measurement_id uuid not null references measurements(id) on delete cascade,
  pricing_version_id uuid references pricing_versions(id) on delete set null,
  price_book_id uuid references price_books(id) on delete set null,
  total_amount numeric(12, 2) not null default 0,
  discount_percent numeric(5, 2) default 0,
  pdf_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotes_org_id on quotes(org_id);
create index if not exists idx_quotes_order_id on quotes(order_id);
create index if not exists idx_quotes_measurement_id on quotes(measurement_id);

-- Quote lines (calculated positions)
create table if not exists quote_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  quote_id uuid not null references quotes(id) on delete cascade,
  measurement_item_id uuid references measurement_items(id) on delete set null,
  description text,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  amount numeric(12, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_quote_lines_org_id on quote_lines(org_id);
create index if not exists idx_quote_lines_quote_id on quote_lines(quote_id);

-- Tasks (assignments per order)
create type task_status as enum ('pending', 'in_progress', 'done', 'cancelled');

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  assignee_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  status task_status not null default 'pending',
  due_date date,
  checklist_json jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_org_id on tasks(org_id);
create index if not exists idx_tasks_order_id on tasks(order_id);
create index if not exists idx_tasks_assignee_id on tasks(assignee_id);
create index if not exists idx_tasks_status on tasks(status);

-- Triggers
create trigger set_price_books_updated_at before update on price_books for each row execute function set_updated_at();
create trigger set_price_items_updated_at before update on price_items for each row execute function set_updated_at();
create trigger set_pricing_rules_updated_at before update on pricing_rules for each row execute function set_updated_at();
create trigger set_quotes_updated_at before update on quotes for each row execute function set_updated_at();
create trigger set_tasks_updated_at before update on tasks for each row execute function set_updated_at();

-- RLS
alter table price_books enable row level security;
alter table price_items enable row level security;
alter table pricing_rules enable row level security;
alter table pricing_versions enable row level security;
alter table quotes enable row level security;
alter table quote_lines enable row level security;
alter table tasks enable row level security;

create policy "price_books_select" on price_books for select using (is_member_of_org(org_id));
create policy "price_books_insert" on price_books for insert with check (has_org_role(org_id, array['admin', 'manager']::role[]));
create policy "price_books_update" on price_books for update using (has_org_role(org_id, array['admin', 'manager']::role[])) with check (has_org_role(org_id, array['admin', 'manager']::role[]));
create policy "price_books_delete" on price_books for delete using (has_org_role(org_id, array['admin']::role[]));

create policy "price_items_select" on price_items for select using (is_member_of_org(org_id));
create policy "price_items_insert" on price_items for insert with check (has_org_role(org_id, array['admin', 'manager']::role[]));
create policy "price_items_update" on price_items for update using (has_org_role(org_id, array['admin', 'manager']::role[])) with check (has_org_role(org_id, array['admin', 'manager']::role[]));
create policy "price_items_delete" on price_items for delete using (has_org_role(org_id, array['admin']::role[]));

create policy "pricing_rules_select" on pricing_rules for select using (is_member_of_org(org_id));
create policy "pricing_rules_insert" on pricing_rules for insert with check (has_org_role(org_id, array['admin', 'manager']::role[]));
create policy "pricing_rules_update" on pricing_rules for update using (has_org_role(org_id, array['admin', 'manager']::role[])) with check (has_org_role(org_id, array['admin', 'manager']::role[]));
create policy "pricing_rules_delete" on pricing_rules for delete using (has_org_role(org_id, array['admin']::role[]));

create policy "pricing_versions_select" on pricing_versions for select using (is_member_of_org(org_id));
create policy "pricing_versions_insert" on pricing_versions for insert with check (has_org_role(org_id, array['admin', 'manager']::role[]));

create policy "quotes_select" on quotes for select using (is_member_of_org(org_id));
create policy "quotes_insert" on quotes for insert with check (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]));
create policy "quotes_update" on quotes for update using (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[])) with check (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]));
create policy "quotes_delete" on quotes for delete using (has_org_role(org_id, array['admin', 'manager']::role[]));

create policy "quote_lines_select" on quote_lines for select using (is_member_of_org(org_id));
create policy "quote_lines_insert" on quote_lines for insert with check (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]));
create policy "quote_lines_update" on quote_lines for update using (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[])) with check (has_org_role(org_id, array['admin', 'manager', 'measurer']::role[]));
create policy "quote_lines_delete" on quote_lines for delete using (has_org_role(org_id, array['admin', 'manager']::role[]));

create policy "tasks_select" on tasks for select using (is_member_of_org(org_id));
create policy "tasks_insert" on tasks for insert with check (has_org_role(org_id, array['admin', 'manager']::role[]));
create policy "tasks_update" on tasks for update using (has_org_role(org_id, array['admin', 'manager']::role[])) with check (has_org_role(org_id, array['admin', 'manager']::role[]));
create policy "tasks_delete" on tasks for delete using (has_org_role(org_id, array['admin', 'manager']::role[]));
