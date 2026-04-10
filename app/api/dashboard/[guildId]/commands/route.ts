import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { requireGuildRequest, routeError } from "@/lib/api/route-helpers";
import { saveCommandSettings } from "@/lib/data/dashboard-write";

const schema = z.object({
  commandPermissions: z.array(
    z.object({
      command_name: z.string(),
      enabled: z.boolean(),
      cooldown: z.number(),
      mode: z.string(),
    }),
  ),
  customCommands: z.array(
    z.object({
      command_name: z.string(),
      description: z.string(),
      response_text: z.string(),
      aliases: z.array(z.string()),
      enabled: z.boolean(),
      cooldown: z.number(),
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
    await saveCommandSettings(guildId, payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
