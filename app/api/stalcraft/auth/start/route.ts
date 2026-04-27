import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildStalcraftAuthUrl, isStalcraftOAuthConfigured } from "@/lib/stalcraft/api";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/api/auth/discord/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  }

  if (!isStalcraftOAuthConfigured()) {
    return NextResponse.redirect(new URL("/stalcraft?error=missing_exbo_oauth", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  }

  const state = crypto.randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("stalcraft_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/",
  });

  return NextResponse.redirect(buildStalcraftAuthUrl(state));
}
