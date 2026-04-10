import { NextRequest, NextResponse } from "next/server";

import { buildDiscordAuthorizeUrl } from "@/lib/auth/discord";
import {
  getStateCookieName,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { isDiscordConfigured } from "@/lib/env";

export async function GET(request: NextRequest) {
  if (!isDiscordConfigured()) {
    return NextResponse.redirect(new URL("/docs", request.nextUrl));
  }

  const state = crypto.randomUUID();
  const response = NextResponse.redirect(buildDiscordAuthorizeUrl(state));

  response.cookies.set(getStateCookieName(), state, sessionCookieOptions());
  return response;
}
