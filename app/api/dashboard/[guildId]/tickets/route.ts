import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { requireGuildRequest, routeError } from "@/lib/api/route-helpers";
import { saveTicketSettings } from "@/lib/data/dashboard-write";

const panelSchema = z.object({
  panel_key: z.string(),
  panel_name: z.string(),
  panel_channel_id: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  button_label: z.string(),
  button_style: z.string(),
  emoji: z.string(),
  category_id: z.string().nullable(),
  log_channel_id: z.string().nullable(),
  ticket_name_template: z.string(),
  enabled: z.boolean(),
});

const schema = z.object({
  enabled: z.boolean(),
  defaultCategoryId: z.string().nullable(),
  defaultLogChannelId: z.string().nullable(),
  transcriptChannelId: z.string().nullable(),
  supportRoles: z.array(z.string()),
  maxOpenPerUser: z.number(),
  panels: z.array(panelSchema),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    await requireGuildRequest(request, guildId);
    const payload = schema.parse(await request.json());
    await saveTicketSettings(guildId, payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
