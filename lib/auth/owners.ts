import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { DiscordSession } from "@/lib/types";

function parseOwnerIds() {
  const raw = process.env.OWNER_IDS || process.env.OWNERS || "";
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function getOwnerIdSet() {
  return parseOwnerIds();
}

export function isOwnerUserId(userId: string | null | undefined) {
  if (!userId) return false;
  return getOwnerIdSet().has(String(userId));
}

export function isOwnerSession(session: DiscordSession | null) {
  return isOwnerUserId(session?.userId);
}

export async function isOwnerUserIdAsync(userId: string | null | undefined) {
  if (isOwnerUserId(userId)) return true;
  if (!userId) return false;

  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("sc_site_owners")
    .select("discord_user_id")
    .eq("discord_user_id", String(userId))
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

export async function isOwnerSessionAsync(session: DiscordSession | null) {
  return isOwnerUserIdAsync(session?.userId);
}

export function assertOwnerSession(session: DiscordSession | null): asserts session is DiscordSession {
  if (!session) {
    throw new Error("Unauthorized");
  }

  if (!isOwnerSession(session)) {
    throw new Error("Forbidden");
  }
}

export async function assertOwnerSessionAsync(session: DiscordSession | null): Promise<void> {
  if (!session) {
    throw new Error("Unauthorized");
  }

  if (!(await isOwnerSessionAsync(session))) {
    throw new Error("Forbidden");
  }
}
