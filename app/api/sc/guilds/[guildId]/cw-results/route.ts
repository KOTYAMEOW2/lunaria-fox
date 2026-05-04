import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertGuildAccess } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";
import { addCwResultRows, clearCwResultRows } from "@/lib/stalcraft/sc-dashboard";

const rowSchema = z.object({
  character_name: z.string().min(1).max(120),
  matches_count: z.number().int().min(1).default(1),
  kills: z.number().int().min(0),
  deaths: z.number().int().min(0),
  assists: z.number().int().min(0),
  treasury_spent: z.number().int().min(0),
  score: z.number().int(),
});

const schema = z.object({
  rows: z.array(rowSchema).min(1).max(300),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const session = await getSession();
    const { guildId } = await params;
    await assertGuildAccess(session, guildId);
    const payload = schema.parse(await request.json());
    const count = await addCwResultRows(guildId, session!.userId, payload.rows);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const session = await getSession();
    const { guildId } = await params;
    await assertGuildAccess(session, guildId);
    const count = await clearCwResultRows(guildId);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 400 });
  }
}
