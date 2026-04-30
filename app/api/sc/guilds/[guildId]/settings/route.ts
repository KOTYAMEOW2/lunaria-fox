import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertGuildAccess } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";
import { saveScGuildSettings } from "@/lib/stalcraft/sc-dashboard";

const schema = z.object({
  community_name: z.string().nullable(),
  clan_id: z.string().nullable(),
  clan_name: z.string().nullable(),
  region: z.string().nullable(),
  cw_post_channel_id: z.string().nullable(),
  absence_channel_id: z.string().nullable(),
  results_channel_id: z.string().nullable(),
  emission_channel_id: z.string().nullable(),
  logs_channel_id: z.string().nullable(),
  sc_commands_channel_id: z.string().nullable(),
  auto_create_roles: z.boolean(),
  roles: z.array(z.object({
    role_key: z.string(),
    role_id: z.string().nullable(),
    role_name: z.string().nullable(),
  })),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const session = await getSession();
    const { guildId } = await params;
    await assertGuildAccess(session, guildId);
    const payload = schema.parse(await request.json());
    await saveScGuildSettings(guildId, session!.userId, payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 400 });
  }
}
