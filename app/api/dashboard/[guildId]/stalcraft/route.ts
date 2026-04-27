import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireGuildRequest, routeError } from "@/lib/api/route-helpers";
import { saveStalcraftGuildSettings } from "@/lib/stalcraft/data";

const schema = z.object({
  enabled: z.boolean(),
  commandsEnabled: z.boolean(),
  videoEnabled: z.boolean(),
  communityName: z.string().max(120).nullable(),
  requiredClanId: z.string().max(128).nullable(),
  requiredClanName: z.string().max(120).nullable(),
  verifiedRoleId: z.string().max(128).nullable(),
  verifiedRoleName: z.string().min(1).max(80),
  roleAutoCreate: z.boolean(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await params;
    const session = await requireGuildRequest(request, guildId);
    const payload = schema.parse(await request.json());
    const settings = await saveStalcraftGuildSettings(guildId, session.userId, payload);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return routeError(error);
  }
}
