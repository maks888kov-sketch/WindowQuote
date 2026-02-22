-- Выполните в Supabase SQL Editor и верните сырые результаты

-- 1. История миграций
select version from supabase_migrations.schema_migrations order by version;

-- 2. Проверка enum role
select typname, enumlabel
from pg_type t
join pg_enum e on t.oid = e.enumtypid
where t.typname = 'role'
order by enumlabel;

-- 3. Проверка функций
select proname, proargtypes::regtype[], prorettype::regtype
from pg_proc
where proname in ('has_org_role','is_member_of_org');

-- 4. Проверка RLS включён ли
select relname, relrowsecurity
from pg_class
where relname in (
'price_books','price_items','pricing_rules','pricing_versions',
'quotes','quote_lines','tasks',
'inventory_items','inventory_movements'
);

-- 5. Проверка количества политик
select tablename, count(*) 
from pg_policies
where tablename in (
'price_books','price_items','pricing_rules','pricing_versions',
'quotes','quote_lines','tasks',
'inventory_items','inventory_movements'
)
group by tablename;
