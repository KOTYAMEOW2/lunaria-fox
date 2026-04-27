import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { requireOwnerRequest, routeError } from "@/lib/api/route-helpers";
import { saveAdminPremiumSettings } from "@/lib/data/dashboard-write";

const schema = z.object({
  premiumActive: z.boolean(),
  planName: z.string().min(1).max(64),
  features: z.array(z.string()),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const session = await requireOwnerRequest();
    const { guildId } = await params;
    const payload = schema.parse(await request.json());
    const result = await saveAdminPremiumSettings(guildId, payload);
    return NextResponse.json({
      ok: true,
      requestedBy: session.userId,
      syncState: result.syncState,
    });
  } catch (error) {
    return routeError(error);
  }
}
