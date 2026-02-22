-- Audit Supabase migrations
-- Run in Supabase Dashboard → SQL Editor → New query

-- 1. Migration history
select version, name
from supabase_migrations.schema_migrations
order by version;

-- 2. Functions exist
select proname
from pg_proc
where pronamespace = (select oid from pg_namespace where nspname = 'public')
  and proname in ('has_org_role', 'is_member_of_org');

-- 3. Type role exists
select typname
from pg_type
where typname = 'role';

-- 4. RLS enabled on tables
select relname, relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and relname in (
    'price_books', 'price_items', 'pricing_rules', 'pricing_versions',
    'quotes', 'quote_lines', 'tasks',
    'inventory_items', 'inventory_movements'
  )
order by relname;

-- 5. Policies on those tables
select polname, tablename
from pg_policies
where schemaname = 'public'
  and tablename in (
    'price_books', 'price_items', 'pricing_rules', 'pricing_versions',
    'quotes', 'quote_lines', 'tasks',
    'inventory_items', 'inventory_movements'
  )
order by tablename, polname;
