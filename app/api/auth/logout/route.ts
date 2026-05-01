import { NextRequest, NextResponse } from "next/server";

import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  } catch {
    // keep redirect behavior even if auth client is not configured
  }

  return NextResponse.redirect(new URL("/", request.nextUrl));
}
