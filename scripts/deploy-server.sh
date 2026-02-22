#!/bin/bash
# Запускать на сервере после git push с ПК
set -e
cd /root/WindowQuote
git pull origin main
cd apps/web
npm install
npm run build
pm2 restart windowquote
echo "Done."
