import type { User } from "@supabase/supabase-js";

import { fetchDiscordUser } from "@/lib/auth/discord";
import { isSupabaseAuthConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import type { DiscordSession } from "@/lib/types";

function readRecordValue(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function getDiscordIdentityRecord(user: User | null) {
  if (!user?.identities || user.identities.length === 0) {
    return null;
  }

  const discordIdentity = user.identities.find((identity) => identity.provider === "discord");
  if (!discordIdentity?.identity_data || typeof discordIdentity.identity_data !== "object") {
    return null;
  }

  return discordIdentity.identity_data as Record<string, unknown>;
}

function buildMetadataFallback(user: User | null) {
  const identity = getDiscordIdentityRecord(user);
  const metadata =
    user?.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : null;

  const userId =
    readRecordValue(identity, "provider_id") ||
    readRecordValue(identity, "sub") ||
    readRecordValue(metadata, "provider_id") ||
    user?.id ||
    "";

  const username =
    readRecordValue(identity, "preferred_username") ||
    readRecordValue(identity, "user_name") ||
    readRecordValue(metadata, "preferred_username") ||
    readRecordValue(metadata, "user_name") ||
    readRecordValue(metadata, "name") ||
    "discord-user";

  const globalName =
    readRecordValue(identity, "global_name") ||
    readRecordValue(metadata, "global_name") ||
    readRecordValue(metadata, "full_name");

  const avatar =
    readRecordValue(identity, "avatar_url") ||
    readRecordValue(metadata, "avatar_url");

  return {
    userId,
    username,
    globalName,
    avatar,
  };
}

export async function getSession() {
  if (!isSupabaseAuthConfigured()) {
    return null;
  }

  const supabase = await createServerSupabase();
  const [{ data: userData, error: userError }, { data: sessionData, error: sessionError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  if (userError || sessionError || !userData.user) {
    return null;
  }

  const providerToken = sessionData.session?.provider_token || null;
  if (!providerToken) {
    return null;
  }

  const metadataFallback = buildMetadataFallback(userData.user);

  try {
    const discordUser = await fetchDiscordUser(providerToken);
    return {
      userId: discordUser.id,
      username: discordUser.username,
      globalName: discordUser.globalName,
      avatar: discordUser.avatar,
      accessToken: providerToken,
      expiresAt: (sessionData.session?.expires_at || 0) * 1000,
    } satisfies DiscordSession;
  } catch {
    if (!metadataFallback.userId) {
      return null;
    }

    return {
      userId: metadataFallback.userId,
      username: metadataFallback.username,
      globalName: metadataFallback.globalName,
      avatar: metadataFallback.avatar,
      accessToken: providerToken,
      expiresAt: (sessionData.session?.expires_at || 0) * 1000,
    } satisfies DiscordSession;
  }
}
