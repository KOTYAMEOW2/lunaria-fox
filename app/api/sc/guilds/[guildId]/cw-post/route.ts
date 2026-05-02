import { NextResponse } from "next/server";

import { assertGuildAccess } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";
import { getAdminBotActionStatus, requestCwPostNow } from "@/lib/stalcraft/sc-dashboard";

export async function GET(request: Request, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const session = await getSession();
    const { guildId } = await params;
    await assertGuildAccess(session, guildId);

    const actionId = new URL(request.url).searchParams.get("actionId");
    if (!actionId) {
      return NextResponse.json({ error: "actionId is required" }, { status: 400 });
    }

    const action = await getAdminBotActionStatus(guildId, actionId);
    return NextResponse.json({ ok: true, action });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 400 });
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const session = await getSession();
    const { guildId } = await params;
    await assertGuildAccess(session, guildId);
    const action = await requestCwPostNow(guildId, session!.userId);
    return NextResponse.json({ ok: true, action });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 400 });
  }
}
