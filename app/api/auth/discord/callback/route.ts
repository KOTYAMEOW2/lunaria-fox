import { NextRequest, NextResponse } from "next/server";

import {
  exchangeDiscordCode,
  fetchDiscordUser,
} from "@/lib/auth/discord";
import {
  createSessionCookie,
  getSessionCookieName,
  getStateCookieName,
  getSessionMaxAge,
  sessionCookieOptions,
} from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get(getStateCookieName())?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/dashboard", url));
  }

  try {
    const token = await exchangeDiscordCode(code);
    const user = await fetchDiscordUser(token.access_token);
    const cookieValue = await createSessionCookie({
      userId: user.id,
      username: user.username,
      globalName: user.globalName,
      avatar: user.avatar,
      accessToken: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    });

    const response = NextResponse.redirect(new URL("/dashboard", url));
    response.cookies.set(getSessionCookieName(), cookieValue, {
      ...sessionCookieOptions(),
      maxAge: getSessionMaxAge(),
    });
    response.cookies.set(getStateCookieName(), "", {
      ...sessionCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/dashboard", url));
  }
}
