import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { syncStalcraftCharacters } from "@/lib/stalcraft/data";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const characters = await syncStalcraftCharacters(session.userId);
    return NextResponse.json({ ok: true, characters });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unable to sync STALCRAFT characters.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
