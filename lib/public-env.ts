function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function safeUrl(value: string, fallback: string) {
  const input = String(value || "").trim();
  return trimTrailingSlash(input || fallback);
}

const siteUrl = safeUrl(process.env.NEXT_PUBLIC_SITE_URL || "", "http://localhost:3000");
const dashboardUrl = safeUrl(process.env.NEXT_PUBLIC_DASHBOARD_URL || "", siteUrl);

export const publicEnv = {
  siteName: process.env.NEXT_PUBLIC_SITE_NAME || "Lunaria Fox",
  siteUrl,
  dashboardUrl,
  supportUrl: process.env.NEXT_PUBLIC_SUPPORT_URL || "https://discord.gg",
  inviteUrl: process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "#",
};

export function buildDashboardUrl(path = "/dashboard") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${publicEnv.dashboardUrl}${normalizedPath}`;
}

export function buildDashboardLoginUrl() {
  return buildDashboardUrl("/api/auth/discord/login");
}

export function buildDashboardLogoutUrl() {
  return buildDashboardUrl("/api/auth/logout");
}

export function isExternalDashboard() {
  return publicEnv.dashboardUrl !== publicEnv.siteUrl;
}
