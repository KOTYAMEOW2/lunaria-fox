import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { requireGuildRequest, routeError } from "@/lib/api/route-helpers";
import { savePremiumSettings } from "@/lib/data/dashboard-write";

const schema = z.object({
  premiumActive: z.boolean(),
  planName: z.string().min(1).max(64),
  features: z.array(z.string()),
  brandRole: z.object({
    role_name: z.string().min(1).max(100),
    color: z.string().min(4).max(16),
    hoist: z.boolean(),
    mentionable: z.boolean(),
  }),
  serverPanelSettings: z.record(z.string(), z.unknown()),
  welcomeSettings: z.record(z.string(), z.unknown()),
  analyticsSettings: z.record(z.string(), z.unknown()),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    await requireGuildRequest(request, guildId);
    const payload = schema.parse(await request.json());
    await savePremiumSettings(guildId, payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
