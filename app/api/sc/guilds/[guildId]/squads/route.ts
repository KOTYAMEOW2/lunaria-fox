import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertGuildAccess } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";
import {
  createCwSquad,
  deleteCwSquad,
  removeCwSquadMember,
  setCwSquadMember,
} from "@/lib/stalcraft/sc-dashboard";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    name: z.string().min(2).max(80),
    description: z.string().max(240).nullable().optional(),
    voice_channel_id: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("delete"),
    squad_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("assign"),
    squad_id: z.string().uuid(),
    discord_user_id: z.string().min(5).max(32),
    character_name: z.string().max(120).nullable().optional(),
  }),
  z.object({
    action: z.literal("remove"),
    squad_id: z.string().uuid(),
    discord_user_id: z.string().min(5).max(32),
  }),
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const session = await getSession();
    const { guildId } = await params;
    await assertGuildAccess(session, guildId);

    const payload = schema.parse(await request.json());

    if (payload.action === "create") {
      const squad = await createCwSquad(guildId, session!.userId, payload);
      return NextResponse.json({ ok: true, squad });
    }

    if (payload.action === "delete") {
      await deleteCwSquad(guildId, payload.squad_id);
      return NextResponse.json({ ok: true });
    }

    if (payload.action === "assign") {
      await setCwSquadMember(guildId, session!.userId, payload);
      return NextResponse.json({ ok: true });
    }

    await removeCwSquadMember(guildId, payload.squad_id, payload.discord_user_id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 400 });
  }
}
