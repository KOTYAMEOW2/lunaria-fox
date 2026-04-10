import { NextRequest, NextResponse } from "next/server";

import { requireGuildRequest, routeError } from "@/lib/api/route-helpers";
import { getGuildSyncState } from "@/lib/data/dashboard-read";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    await requireGuildRequest(request, guildId);
    const syncState = await getGuildSyncState(guildId);
    return NextResponse.json({ ok: true, syncState });
  } catch (error) {
    return routeError(error);
  }
}
