import { NextResponse, type NextRequest } from "next/server";

import { assertGuildAccess } from "@/lib/auth/access";
import { assertOwnerSessionAsync } from "@/lib/auth/owners";
import { getSession } from "@/lib/auth/session";
import type { DiscordSession } from "@/lib/types";

export async function requireGuildRequest(_request: NextRequest, guildId: string): Promise<DiscordSession> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  await assertGuildAccess(session, guildId);
  return session;
}

export async function requireOwnerRequest(): Promise<DiscordSession> {
  const session = await getSession();
  await assertOwnerSessionAsync(session);
  return session as DiscordSession;
}

export function routeError(error: unknown, fallbackStatus = 400) {
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error.message === "Forbidden" || error.message === "Premium required") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json({ error: error.message }, { status: fallbackStatus });
  }

  return NextResponse.json({ error: "Unknown error." }, { status: fallbackStatus });
}
