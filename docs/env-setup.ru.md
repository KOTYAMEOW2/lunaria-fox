# Настройка `.env` для Lunaria Fox

Ниже разложено, что именно брать для сайта и для бота, откуда это брать и куда вставлять.

## 1. Сайт: `.env.local`

Файл создаётся в папке сайта на основе `.env.example`.

`NEXT_PUBLIC_SITE_NAME`

- Это просто публичное имя бренда.
- Ставь: `Lunaria Fox`

`NEXT_PUBLIC_SITE_URL`

- Это адрес публичного сайта.
- Для локальной разработки: `http://localhost:3000`
- Для Cloudflare Pages: твой Pages URL или свой домен, например `https://lunariafox.ru`

`NEXT_PUBLIC_DASHBOARD_URL`

- Это адрес панели управления, куда должны вести кнопки `Dashboard` и `Login with Discord`.
- Если сайт и dashboard живут на одном домене, ставь то же значение, что и `NEXT_PUBLIC_SITE_URL`.
- Если публичный сайт на Cloudflare Pages, а dashboard отдельно, ставь адрес панели, например `https://panel.lunariafox.ru`

`NEXT_PUBLIC_SUPPORT_URL`

- Это ссылка на твой Discord-сервер поддержки.
- Брать из приглашения на сервер, например `https://discord.gg/xxxxxx`

`NEXT_PUBLIC_DISCORD_INVITE_URL`

- Это ссылка приглашения самого бота на сервер.
- Брать из Discord Developer Portal.
- Формат такой:

```text
https://discord.com/oauth2/authorize?client_id=APP_ID&scope=bot%20applications.commands&permissions=8
```

- `APP_ID` берётся тут:
  Discord Developer Portal -> Applications -> твое приложение -> `Application ID`

`DISCORD_CLIENT_ID`

- Брать тут:
  Discord Developer Portal -> Applications -> твое приложение -> OAuth2 / General -> `CLIENT ID`

`DISCORD_CLIENT_SECRET`

- Брать тут:
  Discord Developer Portal -> Applications -> твое приложение -> OAuth2 / General -> `CLIENT SECRET`

`DISCORD_OAUTH_REDIRECT_URI`

- Это самый важный URL для авторизации.
- Он должен один в один совпадать с redirect в Discord OAuth2.
- Если dashboard живёт отдельно, сюда ставится адрес dashboard runtime, а не Pages.
- Пример для локалки:

```text
http://localhost:3000/api/auth/discord/callback
```

- Пример для прода:

```text
https://panel.lunariafox.ru/api/auth/discord/callback
```

- Этот же адрес надо добавить в:
  Discord Developer Portal -> OAuth2 -> Redirects

`SESSION_SECRET`

- Это секрет для подписи session cookie сайта.
- Не должен совпадать с токеном бота.
- Сгенерировать можно так:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`SUPABASE_URL`

- Брать тут:
  Supabase -> Project Settings -> API -> `Project URL`

`SUPABASE_SERVICE_ROLE_KEY`

- Брать тут:
  Supabase -> Project Settings -> API -> `service_role`

- Это секретный ключ.
- Его нельзя публиковать, нельзя хранить в клиентском коде и нельзя слать кому-либо.
- Он нужен сайту только на серверной стороне и нужен боту.

`PREMIUM_GUILDS`

- Необязательно.
- Список guild id через запятую, если хочешь вручную пометить серверы premium без отдельного billing-слоя.

## 2. Бот: `.env`

Файл создаётся в папке бота на основе `.env.example`.

`DISCORD_TOKEN`

- Брать тут:
  Discord Developer Portal -> Bot -> `Reset Token` / `Copy`

`OWNERS`

- Это Discord user id владельцев бота через запятую.
- Как получить:
  Discord -> Settings -> Advanced -> включить `Developer Mode`
- Потом:
  ПКМ по своему профилю -> `Copy User ID`

`PREFIX`

- Любой префикс prefix-команд.
- Например: `.`

`SUPABASE_URL`

- То же значение, что и у сайта.
- Брать из:
  Supabase -> Project Settings -> API -> `Project URL`

`SUPABASE_SERVICE_ROLE_KEY`

- То же значение, что и у сайта.
- Брать из:
  Supabase -> Project Settings -> API -> `service_role`

`SYNC_DELAY_MS`

- Интервал синхронизации guild index с Supabase.
- Обычно оставь `1200`

`COMMAND_REFRESH_TTL_MS`

- Как часто бот переподтягивает command settings и ограничения.
- Обычно оставь `15000`

`CONFIG_REFRESH_TTL_MS`

- Как часто бот переподтягивает guild config, prefix, modules.
- Обычно оставь `15000`

`CUSTOMIZATION_REFRESH_TTL_MS`

- Как часто бот переподтягивает branding и server customizations.
- Обычно оставь `15000`

`PREMIUM_GUILDS`

- Необязательно.
- Список premium guild id через запятую.

`SUPABASE_AUTO_MIGRATE`

- Лучше оставить `false`, если не хочешь неожиданных автодвижений по БД.

## 3. Что должно совпадать между сайтом и ботом

Эти значения должны быть одинаковыми у обоих:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PREMIUM_GUILDS` если используешь ручной premium

## 4. Что должно совпасть в Discord OAuth

- `DISCORD_CLIENT_ID` сайта и `Application ID` приложения Discord
- `DISCORD_OAUTH_REDIRECT_URI` сайта и Redirect URL в Discord Developer Portal
- `NEXT_PUBLIC_DISCORD_INVITE_URL` и тот же `Application ID`

## 5. Что нельзя путать

- `DISCORD_TOKEN` бота и `DISCORD_CLIENT_SECRET` сайта — это разные вещи
- `SUPABASE_SERVICE_ROLE_KEY` и `anon public key` — это разные вещи
- `NEXT_PUBLIC_SITE_URL` и `NEXT_PUBLIC_DASHBOARD_URL` могут совпадать, а могут быть разными
