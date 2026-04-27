import { env } from "@/lib/env";
import type {
  ExboUser,
  StalcraftCharacterApiRow,
  StalcraftCharacterCacheRow,
  StalcraftRegion,
  StalcraftTokenResponse,
} from "@/lib/stalcraft/types";

const DEFAULT_API_BASE = "https://eapi.stalcraft.net";
const DEFAULT_OAUTH_BASE = "https://exbo.net/oauth";
const DEFAULT_SCOPES = "";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getOptionalEnv(name: string, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

export function isStalcraftOAuthConfigured() {
  return Boolean(getOptionalEnv("EXBO_CLIENT_ID") && getOptionalEnv("EXBO_CLIENT_SECRET"));
}

export function getStalcraftApiBase() {
  return trimTrailingSlash(getOptionalEnv("STALCRAFT_API_BASE_URL", DEFAULT_API_BASE));
}

export function getExboOauthBase() {
  return trimTrailingSlash(getOptionalEnv("EXBO_OAUTH_BASE_URL", DEFAULT_OAUTH_BASE));
}

export function getStalcraftRedirectUri() {
  return getOptionalEnv("EXBO_REDIRECT_URI", `${trimTrailingSlash(env.siteUrl)}/api/stalcraft/auth/callback`);
}

export function buildStalcraftAuthUrl(state: string) {
  const url = new URL(`${getExboOauthBase()}/authorize`);
  url.searchParams.set("client_id", getOptionalEnv("EXBO_CLIENT_ID"));
  url.searchParams.set("redirect_uri", getStalcraftRedirectUri());
  url.searchParams.set("response_type", "code");

  const scope = getOptionalEnv("EXBO_SCOPES", DEFAULT_SCOPES);
  if (scope) url.searchParams.set("scope", scope);

  url.searchParams.set("state", state);
  return url.toString();
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = parsed?.message || parsed?.error || response.statusText;
    throw new Error(`STALCRAFT API error ${response.status}: ${detail}`);
  }

  return parsed as T;
}

export async function exchangeStalcraftCode(code: string): Promise<StalcraftTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: getOptionalEnv("EXBO_CLIENT_ID"),
    client_secret: getOptionalEnv("EXBO_CLIENT_SECRET"),
    redirect_uri: getStalcraftRedirectUri(),
  });

  const response = await fetch(`${getExboOauthBase()}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  return readJson<StalcraftTokenResponse>(response);
}

export async function refreshStalcraftToken(refreshToken: string): Promise<StalcraftTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: getOptionalEnv("EXBO_CLIENT_ID"),
    client_secret: getOptionalEnv("EXBO_CLIENT_SECRET"),
  });

  const response = await fetch(`${getExboOauthBase()}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  return readJson<StalcraftTokenResponse>(response);
}

export async function fetchExboUser(accessToken: string): Promise<ExboUser> {
  const response = await fetch(`${getStalcraftApiBase()}/user`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  return readJson<ExboUser>(response);
}

export async function fetchStalcraftCharacters(
  region: StalcraftRegion,
  accessToken: string,
): Promise<StalcraftCharacterCacheRow[]> {
  const response = await fetch(`${getStalcraftApiBase()}/${region}/characters`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const payload = await readJson<{ data?: StalcraftCharacterApiRow[] } | StalcraftCharacterApiRow[]>(response);
  const rows = Array.isArray(payload) ? payload : payload.data || [];
  const now = new Date().toISOString();

  return rows
    .map((item) => {
      const info = item.information || {};
      const clanInfo = item.clan?.info || null;
      const clanMember = item.clan?.member || null;
      const id = String(info.id || "").trim();
      const name = String(info.name || "").trim();

      if (!id || !name) return null;

      return {
        discord_user_id: "",
        region,
        character_id: id,
        character_name: name,
        character_created_at: info.creationTime || null,
        clan_id: clanInfo?.id || null,
        clan_name: clanInfo?.name || null,
        clan_level: clanInfo?.level ?? null,
        clan_alliance: clanInfo?.alliance || null,
        clan_leader: clanInfo?.leader || null,
        clan_rank: clanMember?.rank || null,
        clan_joined_at: clanMember?.joinTime || null,
        raw: item,
        updated_at: now,
      } satisfies StalcraftCharacterCacheRow;
    })
    .filter(Boolean) as StalcraftCharacterCacheRow[];
}

export async function searchStalcraftCharacter(region: StalcraftRegion, characterName: string) {
  const token = getOptionalEnv("STALCRAFT_APPLICATION_TOKEN");
  if (!token) {
    throw new Error("STALCRAFT_APPLICATION_TOKEN is required for public character search.");
  }

  const url = new URL(`${getStalcraftApiBase()}/${region}/characters/${encodeURIComponent(characterName)}/profile`);
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return readJson<unknown>(response);
}
