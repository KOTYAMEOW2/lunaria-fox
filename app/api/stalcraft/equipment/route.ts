import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { saveManualStalcraftEquipment } from "@/lib/stalcraft/data";

const schema = z.object({
  slot: z.enum(["weapon", "armor"]),
  itemName: z.string().min(2).max(120),
  itemRank: z.string().max(60).nullable().optional(),
  itemCategory: z.string().max(60).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = schema.parse(await request.json());
    const equipment = await saveManualStalcraftEquipment(session.userId, payload);
    return NextResponse.json({ ok: true, equipment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 400 });
  }
}
