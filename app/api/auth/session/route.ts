import { NextResponse } from "next/server";

import { isOwnerSession } from "@/lib/auth/owners";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  const owner = isOwnerSession(session);

  return NextResponse.json({
    session: session
      ? {
          username: session.username,
          globalName: session.globalName,
          avatar: session.avatar,
          isOwner: owner,
        }
      : null,
  });
}
