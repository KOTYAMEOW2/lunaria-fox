# Деплой Lunaria Fox на Vercel

## Почему Vercel

Текущий сайт является `Next.js` приложением с серверными route handlers и дашбордом.

В проекте используются:

- `app/api/auth/*`
- `app/api/dashboard/*`
- `/dashboard`
- `/dashboard/[guildId]`
- `Supabase Auth` для входа через Discord

Для такой схемы Vercel подходит напрямую как обычный deployment `Next.js` проекта.

## Что указать в Vercel

1. Импортировать репозиторий в Vercel
2. Framework preset: `Next.js`
3. Root Directory: корень репозитория
4. Build Command:

```text
next build --webpack
```

5. Output Directory не указывать вручную
6. Install Command оставить по умолчанию

## Какие env нужны в Vercel

Минимально нужны:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_DASHBOARD_URL`
- `NEXT_PUBLIC_SUPPORT_URL`
- `NEXT_PUBLIC_DISCORD_INVITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Подробности смотри в [docs/env-setup.ru.md](C:\Users\maksi\OneDrive\Документы\New project\docs\env-setup.ru.md).

## Что важно для авторизации

У сайта callback не в Discord напрямую, а через Supabase Auth.

В Discord Developer Portal redirect URL должен быть:

```text
https://hqggzsfcswtqgwejblxe.supabase.co/auth/v1/callback
```

А в Supabase redirect URLs должны быть callback-адреса самого сайта, например:

```text
https://lunaria-fox.vercel.app/api/auth/discord/callback
```

## Что поставить после первого деплоя

Если Vercel выдал адрес:

```text
https://lunaria-fox.vercel.app
```

то обычно ставишь:

- `NEXT_PUBLIC_SITE_URL=https://lunaria-fox.vercel.app`
- `NEXT_PUBLIC_DASHBOARD_URL=https://lunaria-fox.vercel.app`
- `NEXT_PUBLIC_SUPABASE_URL=<твой Supabase URL>`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<твой publishable key>`
- `SUPABASE_URL=<тот же Supabase URL>`
- `SUPABASE_SERVICE_ROLE_KEY=<service role key>`

После изменения env сделай redeploy.
