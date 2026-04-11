import "server-only";

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

export function assertOwnerSession(session: DiscordSession | null) {
  if (!session) {
    throw new Error("Unauthorized");
  }

  if (!isOwnerSession(session)) {
    throw new Error("Forbidden");
  }
}
