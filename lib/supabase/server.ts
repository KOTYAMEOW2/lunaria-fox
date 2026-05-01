import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env, isSupabaseAuthConfigured } from "@/lib/env";

export async function createServerSupabase() {
  if (!isSupabaseAuthConfigured()) {
    throw new Error("Supabase Auth is not configured.");
  }

  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can read cookies but cannot always persist refreshed tokens.
        }
      },
    },
  });
}
