const env = {
  siteName: process.env.NEXT_PUBLIC_SITE_NAME || "Lunaria Fox",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  dashboardUrl: process.env.NEXT_PUBLIC_DASHBOARD_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  supportUrl: process.env.NEXT_PUBLIC_SUPPORT_URL || "https://discord.gg",
  inviteUrl: process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "#",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
};

export function isSupabaseAuthConfigured() {
  return Boolean(env.supabaseUrl && env.supabasePublishableKey);
}

export function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

export { env };
