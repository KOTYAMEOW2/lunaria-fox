# Деплой Lunaria Fox на Vercel

## Почему Vercel

Текущий сайт уже является full-stack `Next.js` приложением:

- Discord OAuth
- `app/api/auth/*`
- `app/api/dashboard/*`
- `/dashboard`
- `/dashboard/[guildId]`

Для такого проекта Vercel подходит напрямую как обычный `Next.js` deployment с серверными route handlers и dashboard.

## Что нужно в Vercel

1. Импортировать GitHub-репозиторий в Vercel.
2. Framework preset: `Next.js`
3. Root Directory: корень репозитория
4. Build Command:

```text
next build --webpack
```

5. Output Directory не указывать вручную.
6. Install Command можно оставить по умолчанию.

## Переменные окружения

Все значения берутся по [docs/env-setup.ru.md](C:\Users\maksi\OneDrive\Документы\New project\docs\env-setup.ru.md).

Минимально нужны:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_DASHBOARD_URL`
- `NEXT_PUBLIC_SUPPORT_URL`
- `NEXT_PUBLIC_DISCORD_INVITE_URL`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_OAUTH_REDIRECT_URI`
- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Самое важное

`DISCORD_OAUTH_REDIRECT_URI` должен совпасть:

- в `.env`
- в настройках Vercel env
- в Discord Developer Portal -> OAuth2 -> Redirects

Пример:

```text
https://lunaria-fox.vercel.app/api/auth/discord/callback
```

## После первого деплоя

Если Vercel дал адрес:

```text
https://lunaria-fox.vercel.app
```

то обычно ставишь:

- `NEXT_PUBLIC_SITE_URL=https://lunaria-fox.vercel.app`
- `NEXT_PUBLIC_DASHBOARD_URL=https://lunaria-fox.vercel.app`
- `DISCORD_OAUTH_REDIRECT_URI=https://lunaria-fox.vercel.app/api/auth/discord/callback`

Потом обновляешь Redirect URL в Discord Developer Portal и redeploy.
