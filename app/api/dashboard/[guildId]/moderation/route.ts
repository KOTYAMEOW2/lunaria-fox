import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { requireGuildRequest, routeError } from "@/lib/api/route-helpers";
import { saveModerationSettings } from "@/lib/data/dashboard-write";

const schema = z.object({
  smartFilterEnabled: z.boolean(),
  smartFilterAction: z.string(),
  bannedWords: z.array(z.string()),
  regexRules: z.array(z.string()),
  globalLogChannelId: z.string().nullable(),
  globalLogColor: z.string().nullable(),
  rules: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
      enabled: z.boolean(),
    }),
  ),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    await requireGuildRequest(request, guildId);
    const payload = schema.parse(await request.json());
    await saveModerationSettings(guildId, payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
