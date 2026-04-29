import { NextRequest, NextResponse } from "next/server";

import { requireGuildRequest, routeError } from "@/lib/api/route-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    await requireGuildRequest(request, guildId);

    return NextResponse.json(
      {
        ok: false,
        code: "tickets_disabled",
        message: "Tickets module is disabled in Lunaria Lite.",
      },
      { status: 410 },
    );
  } catch (error) {
    return routeError(error);
  }
}
