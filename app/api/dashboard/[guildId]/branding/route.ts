import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { requireGuildRequest, routeError } from "@/lib/api/route-helpers";
import { saveBrandingSettings } from "@/lib/data/dashboard-write";

const schema = z.object({
  embedColor: z.string(),
  footerText: z.string(),
  footerIconUrl: z.string().nullable(),
  webhookName: z.string(),
  webhookAvatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  panelEnabled: z.boolean(),
  panelChannelId: z.string().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    await requireGuildRequest(request, guildId);
    const payload = schema.parse(await request.json());
    const result = await saveBrandingSettings(guildId, payload);
    return NextResponse.json({ ok: true, syncState: result.syncState });
  } catch (error) {
    return routeError(error);
  }
}
