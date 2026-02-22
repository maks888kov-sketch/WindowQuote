# Деплой WindowQuote на Timeweb

Инструкция по развёртыванию на VPS Timeweb (или другом сервере с Node.js).

## Требования

- Node.js 18+ 
- PM2 (для автозапуска): `npm install -g pm2`

## Шаги

### 1. Подключение к серверу

```bash
ssh ваш_пользователь@ваш_сервер
```

### 2. Установка Node.js (если не установлен)

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3. Клонирование репозитория

```bash
cd /var/www  # или другая папка
git clone https://github.com/maks888kov-sketch/WindowQuote.git
cd WindowQuote
```

### 4. Установка зависимостей и сборка

```bash
cd apps/web
npm install
npm run build
```

### 5. Настройка переменных окружения

Создайте файл `.env` в `apps/web/`:

```env
VITE_SUPABASE_URL=https://twfxhvodkgfbbixmsclp.supabase.co
VITE_SUPABASE_ANON_KEY=ваш_anon_key
SUPABASE_URL=https://twfxhvodkgfbbixmsclp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ваш_service_role_key
NODE_ENV=production
PORT=3000
```

Значения возьмите из Supabase: Project Settings → API.

### 6. Запуск через PM2

```bash
cd apps/web
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # автозапуск при перезагрузке
```

### 7. Настройка Nginx (reverse proxy)

Создайте конфиг `/etc/nginx/sites-available/windowquote`:

```nginx
server {
    listen 80;
    server_name ваш_домен.ru;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Включите сайт и перезапустите Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/windowquote /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. SSL (HTTPS) через Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d ваш_домен.ru
```

## Обновление

```bash
cd /var/www/WindowQuote
git pull origin main
cd apps/web
npm install
npm run build
pm2 restart windowquote
```

## Полезные команды PM2

```bash
pm2 status          # статус
pm2 logs windowquote # логи
pm2 restart windowquote # перезапуск
```
