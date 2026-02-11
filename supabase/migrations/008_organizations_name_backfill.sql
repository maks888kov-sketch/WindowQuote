do $$
begin
  if to_regclass('public.organizations') is not null and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'name'
  ) then
    alter table public.organizations add column name text;
  end if;
end
$$;
