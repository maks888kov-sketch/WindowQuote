-- Enable pg_net for async HTTP requests (used by Supabase for webhooks)
create extension if not exists pg_net;

-- Config table for webhook URL (update value after Vercel deploy)
create table if not exists app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

insert into app_config (key, value) values
  ('push_webhook_url', 'https://REPLACE_WITH_YOUR_VERCEL_URL/api/push-send')
on conflict (key) do nothing;

-- Helper to get webhook URL (returns null if not configured)
create or replace function get_push_webhook_url()
returns text
language sql
stable
as $$
  select value from app_config where key = 'push_webhook_url' and value not like '%REPLACE_%';
$$;

-- Trigger function: tasks INSERT/UPDATE → POST to push-send
create or replace function notify_push_on_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hook_url text;
  payload jsonb;
begin
  hook_url := get_push_webhook_url();
  if hook_url is null then
    return coalesce(new, old);
  end if;

  payload := jsonb_build_object(
    'type', tg_op,
    'table', tg_table_name,
    'schema', tg_table_schema,
    'record', to_jsonb(coalesce(new, old)),
    'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
  );

  perform net.http_post(
    url := hook_url,
    body := payload,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists push_webhook_tasks on tasks;
create trigger push_webhook_tasks
  after insert or update on tasks
  for each row
  execute function notify_push_on_task_change();

-- Trigger function: orders UPDATE (status change) → POST to push-send
create or replace function notify_push_on_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hook_url text;
  payload jsonb;
begin
  if tg_op != 'UPDATE' or old.status = new.status then
    return new;
  end if;

  hook_url := get_push_webhook_url();
  if hook_url is null then
    return new;
  end if;

  payload := jsonb_build_object(
    'type', 'UPDATE',
    'table', 'orders',
    'schema', tg_table_schema,
    'record', to_jsonb(new),
    'old_record', to_jsonb(old)
  );

  perform net.http_post(
    url := hook_url,
    body := payload,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

drop trigger if exists push_webhook_orders on orders;
create trigger push_webhook_orders
  after update on orders
  for each row
  execute function notify_push_on_order_change();

-- Usage: after deploying to Vercel, run:
-- update app_config set value = 'https://your-app.vercel.app/api/push-send' where key = 'push_webhook_url';
