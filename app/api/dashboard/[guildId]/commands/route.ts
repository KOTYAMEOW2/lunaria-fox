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
      allow_roles: z.array(z.string()).optional(),
      deny_roles: z.array(z.string()).optional(),
      allow_users: z.array(z.string()).optional(),
      deny_users: z.array(z.string()).optional(),
      allow_groups: z.array(z.string()).optional(),
      deny_groups: z.array(z.string()).optional(),
      allow_channels: z.array(z.string()).optional(),
      deny_channels: z.array(z.string()).optional(),
    }),
  ),
  commandGroups: z.array(
    z.object({
      group_id: z.string(),
      name: z.string(),
      roles: z.array(z.string()),
      scopes: z.array(z.string()),
      color: z.string().nullable().optional(),
      is_default: z.boolean().optional(),
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
    const result = await saveCommandSettings(guildId, payload);
    return NextResponse.json({ ok: true, syncState: result.syncState });
  } catch (error) {
    return routeError(error);
  }
}
