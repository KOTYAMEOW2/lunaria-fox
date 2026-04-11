# Настройка `.env` для Lunaria Fox

Ниже указано, какие значения нужны для сайта и для бота, где их брать и что должно совпадать.

## 1. Сайт: `.env.local`

Файл создаётся в корне сайта на основе `.env.example`.

`NEXT_PUBLIC_SITE_NAME`

- Публичное имя проекта.
- Для этого сайта: `Lunaria Fox`

`NEXT_PUBLIC_SITE_URL`

- Адрес сайта.
- Для локальной разработки: `http://localhost:3000`
- Для прода на Vercel: `https://lunaria-fox.vercel.app` или свой домен

`NEXT_PUBLIC_DASHBOARD_URL`

- Адрес панели.
- Если сайт и дашборд живут на одном проекте, ставь то же значение, что и `NEXT_PUBLIC_SITE_URL`

`NEXT_PUBLIC_SUPPORT_URL`

- Ссылка на Discord-сервер поддержки.

`NEXT_PUBLIC_DISCORD_INVITE_URL`

- Ссылка приглашения самого бота.
- Формат:

```text
https://discord.com/oauth2/authorize?client_id=APP_ID&scope=bot%20applications.commands&permissions=8
```

`APP_ID` берётся в Discord Developer Portal -> Application -> `Application ID`

`NEXT_PUBLIC_SUPABASE_URL`

- Брать в Supabase -> Project Settings -> API -> `Project URL`

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

- Брать в Supabase -> Project Settings -> API -> `publishable key`
- Если в проекте у тебя показывается `anon key`, можно использовать его

`SUPABASE_URL`

- Можно поставить то же значение, что и `NEXT_PUBLIC_SUPABASE_URL`
- Используется серверной частью сайта и ботом

`SUPABASE_SERVICE_ROLE_KEY`

- Брать в Supabase -> Project Settings -> API -> `service_role`
- Это закрытый ключ
- Его нельзя публиковать в клиентском коде

`PREMIUM_GUILDS`

- Необязательно
- Список `guild_id` через запятую, если хочешь вручную включать premium без отдельного billing-слоя

## 2. Как теперь работает вход через Discord

Сайт больше не использует прямой `DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET` внутри Next.js.

Вход теперь идёт через `Supabase Auth -> Providers -> Discord`.

Что нужно проверить:

1. В Supabase открой `Authentication -> Providers -> Discord`
2. Включи Discord provider
3. В Discord Developer Portal как redirect URL укажи:

```text
https://hqggzsfcswtqgwejblxe.supabase.co/auth/v1/callback
```

4. В Supabase в списке redirect URLs добавь:

```text
http://localhost:3000/api/auth/discord/callback
https://lunaria-fox.vercel.app/api/auth/discord/callback
```

Если у тебя будет свой домен, добавь и его callback по тому же шаблону.

## 3. Бот: `.env`

Файл создаётся в папке бота на основе `.env.example`.

`DISCORD_TOKEN`

- Брать в Discord Developer Portal -> Bot -> `Token`

`OWNERS`

- Discord user id владельцев через запятую
- Получить можно через Discord Developer Mode -> `Copy User ID`

`PREFIX`

- Префикс prefix-команд
- Например: `.`

`SUPABASE_URL`

- То же значение, что и у сайта

`SUPABASE_SERVICE_ROLE_KEY`

- То же значение, что и у сайта

`SYNC_DELAY_MS`

- Интервал синхронизации guild index с Supabase
- Обычно оставляй `1200`

`COMMAND_REFRESH_TTL_MS`

- Как часто бот переподтягивает command settings
- Обычно оставляй `15000`

`CONFIG_REFRESH_TTL_MS`

- Как часто бот переподтягивает prefix, модули и базовые настройки
- Обычно оставляй `15000`

`CUSTOMIZATION_REFRESH_TTL_MS`

- Как часто бот переподтягивает брендинг и кастомизацию
- Обычно оставляй `15000`

`PREMIUM_GUILDS`

- Необязательно
- Если используешь, список должен совпадать с сайтом

## 4. Что должно совпадать между сайтом и ботом

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PREMIUM_GUILDS`, если используешь ручной premium

## 5. Что не нужно путать

- `DISCORD_TOKEN` бота и ключи Supabase — это разные вещи
- `SUPABASE_SERVICE_ROLE_KEY` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — это разные ключи
- `NEXT_PUBLIC_SITE_URL` и `NEXT_PUBLIC_DASHBOARD_URL` могут совпадать

## 6. Что применить в Supabase

- `docs/supabase-premium.sql` — premium-функции
- `docs/supabase-control-plane.sql` — статусы синхронизации между сайтом и ботом

## 7. Что обязательно должно работать после настройки

1. Вход на сайт через Discord
2. Открытие `/dashboard`
3. Сохранение настроек сервера
4. Появление новой `revision` в `dashboard_sync_states`
5. Применение новых настроек ботом без ручного редактирования базы
