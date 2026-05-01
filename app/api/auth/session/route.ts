import { NextResponse } from "next/server";

import { isOwnerSessionAsync } from "@/lib/auth/owners";
import { getSession } from "@/lib/auth/session";
import { getStalcraftProfile } from "@/lib/stalcraft/data";

export async function GET() {
  const session = await getSession();
  const owner = await isOwnerSessionAsync(session);
  const stalcraftProfile = session ? await getStalcraftProfile(session.userId).catch(() => null) : null;

  return NextResponse.json({
    session: session
      ? {
          username: session.username,
          globalName: session.globalName,
          avatar: session.avatar,
          isOwner: owner,
          stalcraftLinked: Boolean(stalcraftProfile?.selected_character_id),
        }
      : null,
  });
}
