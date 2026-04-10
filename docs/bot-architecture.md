# Lunaria Fox Bot Architecture

Сайт проектируется не абстрактно, а от реального бандла бота, который был приложен локально.

## Рантайм

- Бот написан на `Node.js` и `discord.js 14`.
- Конфигурация берётся из `.env`.
- Основная точка входа: `src/index.js`.
- Модули команд автоматически подгружаются из `src/modules/**/index.js`.
- При старте бот:
  - инициализирует кеши и service-layer сторы
  - собирает и публикует slash commands
  - синхронизирует реестр команд в `commands_registry`
  - синхронизирует гильдии, админов, роли и каналы в Supabase

## Корневая сущность данных

`bot_guilds` это ядро схемы. Почти все таблицы в Supabase привязаны к `guild_id`, поэтому веб-дашборд тоже строится вокруг серверов.

## Подтверждённые модули бота

- server panel
- custom commands
- permissions / command groups
- analytics
- moderation / cases / history / appeals
- blacklist
- logging
- smart filter
- roles and brand roles
- tickets
- VoiceMaster
- diagnostics / guild logs / prefix transport

## Подтверждённые таблицы Supabase

- `bot_guilds`
- `guild_configs`
- `server_customizations`
- `server_panels`
- `commands_registry`
- `command_groups`
- `command_permissions`
- `custom_commands`
- `guild_roles`
- `guild_channels`
- `guild_admins`
- `guild_cases`
- `guild_mod_history`
- `guild_log_settings`
- `guild_log_entries`
- `guild_rules`
- `smartfilter_configs`
- `appeals`
- `ticket_configs`
- `ticket_panels`
- `tickets`
- `voicemaster_configs`
- `voicemaster_rooms`
- `temp_bans`
- `temp_roles`
- `brand_roles`
- `bot_analytics`
- `blacklisted_guilds`
- `blacklisted_users`

## Ограничения текущего бандла

- XP / ranking / leveling в коде бота не найдены.
- Полноценная биллинговая подписочная система в бандле не найдена.
- Premium сейчас подтверждён как env-based gating минимум для VoiceMaster.

Это значит, что сайт уже можно делать полнофункциональным для существующих модулей, а parity с JuniperBot по ranking/subscriptions потребует расширения backend-логики бота.
