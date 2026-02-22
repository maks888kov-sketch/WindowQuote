-- Profile catalog per price book (brand, profile type, section, cost per meter) for Romchi-style configurator
create table if not exists profile_catalog (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  price_book_id uuid not null references price_books(id) on delete cascade,
  brand text not null,
  profile_type text not null,
  section text,
  cost_per_meter numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profile_catalog_org_id on profile_catalog(org_id);
create index if not exists idx_profile_catalog_price_book_id on profile_catalog(price_book_id);

create trigger set_profile_catalog_updated_at before update on profile_catalog for each row execute function set_updated_at();

alter table profile_catalog enable row level security;
drop policy if exists "profile_catalog_select" on profile_catalog;
drop policy if exists "profile_catalog_insert" on profile_catalog;
drop policy if exists "profile_catalog_update" on profile_catalog;
drop policy if exists "profile_catalog_delete" on profile_catalog;
create policy "profile_catalog_select" on profile_catalog for select using (is_member_of_org(org_id));
create policy "profile_catalog_insert" on profile_catalog for insert with check (has_org_role(org_id, array['admin', 'manager']::role[]));
create policy "profile_catalog_update" on profile_catalog for update using (has_org_role(org_id, array['admin', 'manager']::role[])) with check (has_org_role(org_id, array['admin', 'manager']::role[]));
create policy "profile_catalog_delete" on profile_catalog for delete using (has_org_role(org_id, array['admin', 'manager']::role[]));
