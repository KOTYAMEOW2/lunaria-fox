import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { unlinkStalcraftProfile } from "@/lib/stalcraft/data";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await unlinkStalcraftProfile(session.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unlink_failed" }, { status: 400 });
  }
}
