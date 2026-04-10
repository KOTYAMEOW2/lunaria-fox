import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();

  return NextResponse.json({
    session: session
      ? {
          username: session.username,
          globalName: session.globalName,
          avatar: session.avatar,
        }
      : null,
  });
}
