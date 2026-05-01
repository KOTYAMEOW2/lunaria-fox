import { NextRequest, NextResponse } from "next/server";

import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const nextPath = url.searchParams.get("next");
  const next = nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL(next, url));
  }

  try {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL("/dashboard?auth_error=oauth_callback", url));
    }

    return NextResponse.redirect(new URL(next, url));
  } catch {
    return NextResponse.redirect(new URL("/dashboard?auth_error=oauth_callback", url));
  }
}
