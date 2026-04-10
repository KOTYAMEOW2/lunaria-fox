export const featureCards = [
  {
    eyebrow: "Server Control",
    title: "Дашборд, который реально понимает структуру бота",
    body:
      "Сайт строится вокруг тех же таблиц Supabase, которые уже использует Lunaria Fox: серверы, роли, каналы, команды, тикеты, VoiceMaster, модерация и брендинг.",
  },
  {
    eyebrow: "Moderation",
    title: "Smart filter, логи, кейсы и appeals",
    body:
      "Управление модерацией не оторвано от Discord-состояния. В дашборде учитываются правила сервера, журналы, temp-ban/temp-role и все ключевые конфигурации.",
  },
  {
    eyebrow: "Operations",
    title: "VoiceMaster, tickets и custom commands",
    body:
      "Те модули, которые уже есть в боте, отражены как самостоятельные панели управления, а не как набор бессвязных форм.",
  },
];

export const roadmapCards = [
  "Discord OAuth с выбором доступных серверов",
  "Публичный лендинг, pricing и docs",
  "Интерактивный дашборд для конфигов бота",
  "Подключение premium-логики поверх текущего env-based gating",
  "Дальнейшая доводка до полного parity с JuniperBot",
];

export const pricingTiers = [
  {
    name: "Free",
    price: "0 ₽",
    lead: "Базовое управление сервером",
    bullets: [
      "Панель сервера и общие настройки",
      "Custom commands, smart filter и логирование",
      "Tickets и VoiceMaster core",
    ],
  },
  {
    name: "Lunar+",
    price: "В разработке",
    lead: "Premium-слой поверх текущей архитектуры бота",
    bullets: [
      "VoiceMaster hide/show",
      "Voice bitrate выше 64 kbps",
      "Будущие perks и подписки через сайт",
    ],
  },
];

export const docsSections = [
  {
    title: "Что сайт уже умеет",
    items: [
      "Поднимать публичный фронт бренда Lunaria Fox.",
      "Авторизовывать через Discord OAuth и собирать список управляемых серверов.",
      "Работать с реальным Supabase-слоем бота по guild-centric модели данных.",
    ],
  },
  {
    title: "Ключевые сущности",
    items: [
      "`bot_guilds` как корневая сущность сайта и дашборда.",
      "`guild_configs`, `server_customizations`, `server_panels` для базовых настроек.",
      "`custom_commands`, `command_permissions`, `command_groups` для command center.",
      "`smartfilter_configs`, `guild_rules`, `guild_log_settings` для модерации.",
      "`ticket_configs`, `ticket_panels`, `tickets` для helpdesk слоя.",
      "`voicemaster_configs`, `voicemaster_rooms` для голосовых комнат.",
    ],
  },
];
