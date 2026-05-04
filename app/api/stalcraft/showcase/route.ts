import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { saveStalcraftProfileShowcase } from "@/lib/stalcraft/data";

const schema = z.object({
  title: z.string().max(80).nullable().optional(),
  bio: z.string().max(400).nullable().optional(),
  visibility: z.enum(["public", "clan", "private"]),
  pinnedWeaponId: z.string().uuid().nullable().optional(),
  pinnedArmorId: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = schema.parse(await request.json());
    const showcase = await saveStalcraftProfileShowcase(session.userId, {
      title: payload.title ?? null,
      bio: payload.bio ?? null,
      visibility: payload.visibility,
      pinnedWeaponId: payload.pinnedWeaponId ?? null,
      pinnedArmorId: payload.pinnedArmorId ?? null,
    });
    return NextResponse.json({ ok: true, showcase });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 400 });
  }
}
