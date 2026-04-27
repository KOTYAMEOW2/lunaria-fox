import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { linkStalcraftProfileFromCode } from "@/lib/stalcraft/data";

function redirectTo(path: string) {
  return NextResponse.redirect(new URL(path, process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
}

function safeErrorMessage(caught: unknown) {
  if (caught instanceof Error && caught.message) return caught.message;

  if (caught && typeof caught === "object") {
    const value = caught as {
      message?: unknown;
      details?: unknown;
      detail?: unknown;
      error_description?: unknown;
      error?: unknown;
      code?: unknown;
    };
    const raw =
      value.message ||
      value.details ||
      value.detail ||
      value.error_description ||
      value.error ||
      value.code;
    if (raw) return String(raw);
  }

  if (typeof caught === "string" && caught.trim()) return caught.trim();
  return "stalcraft_link_failed";
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return redirectTo("/api/auth/discord/login");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return redirectTo(`/stalcraft?error=${encodeURIComponent(error)}`);
  if (!code || !state) return redirectTo("/stalcraft?error=missing_oauth_code");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("stalcraft_oauth_state")?.value;
  cookieStore.delete("stalcraft_oauth_state");

  if (!expectedState || expectedState !== state) {
    return redirectTo("/stalcraft?error=invalid_oauth_state");
  }

  try {
    await linkStalcraftProfileFromCode(session.userId, code);
    return redirectTo("/stalcraft?linked=1");
  } catch (caught) {
    const message = safeErrorMessage(caught);
    console.error("[stalcraft-auth] link failed:", message);
    return redirectTo(`/stalcraft?error=${encodeURIComponent(message)}`);
  }
}
