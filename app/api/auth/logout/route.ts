import { NextRequest, NextResponse } from "next/server";

import {
  getSessionCookieName,
  getStateCookieName,
  sessionCookieOptions,
} from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.nextUrl));

  response.cookies.set(getSessionCookieName(), "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  response.cookies.set(getStateCookieName(), "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });

  return response;
}
