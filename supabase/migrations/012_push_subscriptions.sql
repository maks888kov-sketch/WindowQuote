create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index idx_push_subscriptions_org_id on push_subscriptions(org_id);
create index idx_push_subscriptions_user_id on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions_select" on push_subscriptions for select using (user_id = auth.uid());
create policy "push_subscriptions_insert" on push_subscriptions for insert with check (user_id = auth.uid());
create policy "push_subscriptions_delete" on push_subscriptions for delete using (user_id = auth.uid());
