# Cloudflare схема для Lunaria Fox

## Рекомендуемая прод-схема

Для текущего проекта правильнее всего использовать разделение на две части:

1. `Cloudflare Pages`
   Здесь живёт публичный сайт: главная, features, commands, pricing, docs.

2. `Dashboard runtime`
   Здесь живут:
   - Discord OAuth
   - `/api/auth/*`
   - `/api/dashboard/*`
   - `/dashboard`
   - `/dashboard/[guildId]`

Причина простая: проект уже содержит серверные route handlers, session cookies и серверную работу с Supabase. Это не чистый static site.

## Как это выглядит по доменам

Пример:

- публичный сайт: `https://lunariafox.ru`
- dashboard: `https://panel.lunariafox.ru`

Тогда:

- `NEXT_PUBLIC_SITE_URL=https://lunariafox.ru`
- `NEXT_PUBLIC_DASHBOARD_URL=https://panel.lunariafox.ru`
- `DISCORD_OAUTH_REDIRECT_URI=https://panel.lunariafox.ru/api/auth/discord/callback`

## Что уже подготовлено в коде

- кнопки `Dashboard` и `Login with Discord` теперь могут вести на отдельный dashboard URL;
- публичная шапка не требует server session на уровне root layout;
- появился отдельный `GET /api/auth/session` для runtime-версии сайта;
- `NEXT_PUBLIC_DASHBOARD_URL` вынесен в `.env.example`.

## Когда можно ставить одинаковые URL

Если ты всё-таки деплоишь сайт и dashboard в один runtime, то ставь:

- `NEXT_PUBLIC_SITE_URL` = `NEXT_PUBLIC_DASHBOARD_URL`

Это тоже поддерживается.

## Что важно помнить

- redirect URI в Discord OAuth всегда должен указывать на dashboard runtime;
- `service_role` ключ Supabase нельзя хранить в чисто статическом фронте;
- bot и dashboard должны смотреть в одну и ту же Supabase базу.
