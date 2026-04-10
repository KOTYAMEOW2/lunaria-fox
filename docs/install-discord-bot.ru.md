# Discord бот Lunaria Fox

Папка содержит только код Discord-бота.

## Что делать

1. Открой эту папку.
2. Скопируй `.env.example` в `.env`.
3. Заполни значения по `docs/env-setup.ru.md`.
4. Если нужен новый premium-слой, сначала выполни SQL из `docs/supabase-premium.sql`.
5. Для live sync-status между сайтом и ботом выполни SQL из `docs/supabase-control-plane.sql`.
6. Выполни `npm install`.
7. Для обычного запуска выполни `npm start`.
8. Для миграции старых JSON-данных в Supabase используй `npm run migrate`.

## Что уже исправлено

- приведены записи в Supabase к реальным таблицам `server_customizations`, `command_permissions`, `custom_commands`, `tickets` и связанным сущностям;
- восстановлена совместимость legacy-мигратора;
- исправлены ESM-импорты и старые helper-экспорты, из-за которых часть модулей не загружалась;
- добавлены premium-сущности `guild_premium_settings`, `brand_roles`, `bot_analytics`;
- настройки из Supabase теперь влияют на prefix, module toggles, command visibility и premium-слой без обязательного рестарта;
- пройден импортный smoke-test по всему `src`, кроме основного раннера, который реально логинится в Discord.

## Важно

- В архиве нет рабочего `.env`, чтобы не утекли секреты.
- Полный live-запуск против Discord и боевого Supabase лучше делать после резервной копии базы или на тестовом сервере.
