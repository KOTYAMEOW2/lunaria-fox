const env = {
  siteName: process.env.NEXT_PUBLIC_SITE_NAME || "Lunaria Fox",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  dashboardUrl: process.env.NEXT_PUBLIC_DASHBOARD_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  supportUrl: process.env.NEXT_PUBLIC_SUPPORT_URL || "https://discord.gg",
  inviteUrl: process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "#",
  discordClientId: process.env.DISCORD_CLIENT_ID || "",
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET || "",
  discordRedirectUri: process.env.DISCORD_OAUTH_REDIRECT_URI || "",
  sessionSecret: process.env.SESSION_SECRET || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  premiumGuilds: process.env.PREMIUM_GUILDS || "",
};

export function isDiscordConfigured() {
  return Boolean(
    env.discordClientId &&
      env.discordClientSecret &&
      env.discordRedirectUri &&
      env.sessionSecret,
  );
}

export function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

export function getPremiumGuildSet() {
  return new Set(
    env.premiumGuilds
      .split(",")
      .map((guildId) => guildId.trim())
      .filter(Boolean),
  );
}

export { env };
