# Сайт Lunaria Fox

Папка содержит только сайт и дашборд бота.

## Что делать

1. Открой эту папку.
2. Скопируй `.env.example` в `.env.local`.
3. Заполни переменные по `docs/env-setup.ru.md`.
4. Если нужен premium-раздел, выполни SQL из `docs/supabase-premium.sql`.
5. Для статусов синхронизации между сайтом и ботом выполни SQL из `docs/supabase-control-plane.sql`.
6. Схему деплоя смотри в `docs/vercel-deploy.ru.md`.
7. Выполни `npm install`.
8. Для локального запуска выполни `npm run dev`.
9. Для production-сборки выполни `npm run build`.
10. Для локальной проверки production-режима используй `npm run start`.
11. Для деплоя подключи репозиторий в Vercel.

## Важно

- Фон сайта подключён через `public/lunaria-background.png`.
- В архив специально не вложены реальные секреты.
- Сайт и бот должны использовать одну и ту же базу Supabase.
- Проект рассчитан на обычный `Next.js` deployment в Vercel.
- Вход на сайт идёт через `Supabase Auth` с Discord provider.
