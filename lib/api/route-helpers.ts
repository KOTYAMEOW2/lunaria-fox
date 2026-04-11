import { NextResponse, type NextRequest } from "next/server";

import { assertGuildAccess } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";

export async function requireGuildRequest(_request: NextRequest, guildId: string) {
  const session = await getSession();
  await assertGuildAccess(session, guildId);
  return session;
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
