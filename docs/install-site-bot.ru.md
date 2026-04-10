# Сайт Lunaria Fox

Папка содержит только сайт и дашборд бота.

## Что делать

1. Открой эту папку.
2. Скопируй `.env.example` в `.env.local`.
3. Заполни переменные по `docs/env-setup.ru.md`.
4. Если нужен новый premium-раздел, сначала выполни SQL из `docs/supabase-premium.sql` в своей Supabase.
5. Для live sync-status между сайтом и ботом выполни SQL из `docs/supabase-control-plane.sql`.
6. Схему деплоя смотри в `docs/vercel-deploy.ru.md`.
7. Выполни `npm install`.
8. Для локального запуска выполни `npm run dev`.
9. Для сборки текущего full-stack проекта выполни `npm run build`.
10. Для локальной проверки production-режима используй `npm run start`.
11. Для деплоя подключи репозиторий в Vercel.

## Важно

- Фон сайта уже подключён через `public/lunaria-background.png`.
- В архив специально не вложены реальные секреты.
- Сайт ожидает, что бот и сайт используют одну и ту же базу Supabase.
- Проект рассчитан на обычный `Next.js` deployment в Vercel.
- Здесь есть Discord OAuth, API routes и серверный dashboard, поэтому это не просто статический сайт.
