import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { requireGuildRequest, routeError } from "@/lib/api/route-helpers";
import { saveVoicemasterSettings } from "@/lib/data/dashboard-write";

const schema = z.object({
  enabled: z.boolean(),
  creatorChannelId: z.string().nullable(),
  categoryId: z.string().nullable(),
  logChannelId: z.string().nullable(),
  roomNameTemplate: z.string(),
  defaultUserLimit: z.number(),
  defaultBitrate: z.number(),
  allowOwnerRename: z.boolean(),
  allowOwnerLimit: z.boolean(),
  allowOwnerLock: z.boolean(),
  allowOwnerHide: z.boolean(),
  hubs: z.record(z.string(), z.unknown()),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    await requireGuildRequest(request, guildId);
    const payload = schema.parse(await request.json());
    const result = await saveVoicemasterSettings(guildId, payload);
    return NextResponse.json({ ok: true, syncState: result.syncState });
  } catch (error) {
    return routeError(error);
  }
}
