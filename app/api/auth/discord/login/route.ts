import { NextRequest, NextResponse } from "next/server";

import { isSupabaseAuthConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.redirect(new URL("/dashboard?auth_error=missing_supabase_auth", request.nextUrl));
  }

  const nextPath = request.nextUrl.searchParams.get("next");
  const next = nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard";
  const callbackUrl = new URL("/api/auth/discord/callback", request.nextUrl.origin);
  callbackUrl.searchParams.set("next", next);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: callbackUrl.toString(),
      scopes: "identify guilds",
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/dashboard?auth_error=oauth_start", request.nextUrl));
  }

  return NextResponse.redirect(data.url);
}
