import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { deleteStalcraftEquipment, saveManualStalcraftEquipment } from "@/lib/stalcraft/data";

const schema = z.object({
  slot: z.enum(["weapon", "armor"]),
  equipmentId: z.string().uuid().nullable().optional(),
  itemName: z.string().min(2).max(120).nullable().optional(),
  itemRank: z.string().max(60).nullable().optional(),
  itemCategory: z.string().max(60).nullable().optional(),
  allowManualFallback: z.boolean().nullable().optional(),
}).refine((value) => Boolean(value.equipmentId || (value.itemName && value.itemName.trim().length >= 2)), {
  message: "Нужно выбрать найденный предмет или указать название.",
  path: ["itemName"],
});

const deleteSchema = z.object({
  equipmentId: z.string().uuid(),
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

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = deleteSchema.parse(await request.json());
    const deleted = await deleteStalcraftEquipment(session.userId, payload.equipmentId);
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 400 });
  }
}
