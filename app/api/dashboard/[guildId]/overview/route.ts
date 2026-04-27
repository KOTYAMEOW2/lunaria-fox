import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { requireGuildRequest, routeError } from "@/lib/api/route-helpers";
import { saveGuildOverview } from "@/lib/data/dashboard-write";

const schema = z.object({
  prefix: z.string().min(1).max(5),
  language: z.string().default("ru"),
  appealsChannelId: z.string().nullable(),
  dmPunishEnabled: z.boolean(),
  modRoles: z.array(z.string()),
  adminRoles: z.array(z.string()),
  enabledModules: z.record(z.string(), z.boolean()),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    await requireGuildRequest(request, guildId);
    const payload = schema.parse(await request.json());
    const result = await saveGuildOverview(guildId, payload);
    return NextResponse.json({ ok: true, syncState: result.syncState });
  } catch (error) {
    return routeError(error);
  }
}
