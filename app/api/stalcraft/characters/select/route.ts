import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { selectStalcraftCharacter } from "@/lib/stalcraft/data";

const schema = z.object({
  region: z.enum(["RU", "EU", "NA", "SEA"]),
  characterId: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = schema.parse(await request.json());
    const character = await selectStalcraftCharacter(session.userId, payload.region, payload.characterId);
    return NextResponse.json({ ok: true, character });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unable to select STALCRAFT character.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
