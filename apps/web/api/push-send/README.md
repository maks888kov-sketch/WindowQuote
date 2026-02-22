# Push Send API

`POST /api/push-send` — отправляет Web Push уведомления при изменениях в tasks и orders.

## Настройка (миграция 013)

Webhooks настроены через миграцию `013_push_webhooks.sql` (pg_net + триггеры на tasks и orders).

### Шаг 1. Применить миграцию

```bash
npx supabase db push
```

### Шаг 2. Указать URL после деплоя на Vercel

В Supabase SQL Editor выполните (подставьте свой URL):

```sql
update app_config
set value = 'https://ваше-приложение.vercel.app/api/push-send'
where key = 'push_webhook_url';
```

### Альтернатива: Webhooks через Dashboard

Supabase Dashboard → Database → Webhooks:

1. **tasks** — Insert, Update → URL: `https://ваш-домен.vercel.app/api/push-send`
2. **orders** — Update → тот же URL

## Переменные окружения

- `VAPID_PRIVATE_KEY` / `VITE_VAPID_PUBLIC_KEY` — ключи Web Push
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — доступ к БД

## Формат входящего body

```json
{
  "type": "INSERT",
  "table": "tasks",
  "record": { "id": "...", "org_id": "...", "assignee_id": "...", "title": "..." },
  "old_record": null
}
```
