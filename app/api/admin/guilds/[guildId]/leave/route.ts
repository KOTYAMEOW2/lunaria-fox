import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertOwnerSessionAsync } from "@/lib/auth/owners";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const session = await getSession();
    await assertOwnerSessionAsync(session);

    const { guildId } = await params;
    const body = schema.parse(await request.json().catch(() => ({})));
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data: existing, error: existingError } = await supabase
      .from("sc_admin_bot_actions")
      .select("id, status")
      .eq("guild_id", guildId)
      .eq("action", "leave_guild")
      .in("status", ["pending", "processing"])
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return NextResponse.json(
        { error: "Заявка на удаление этого сервера уже ожидает обработки.", action: existing },
        { status: 409 },
      );
    }

    const { data: action, error } = await supabase
      .from("sc_admin_bot_actions")
      .insert({
        guild_id: guildId,
        action: "leave_guild",
        status: "pending",
        reason: body.reason || "Удаление через админ-панель",
        requested_by: session!.userId,
        created_at: new Date().toISOString(),
      })
      .select("id, guild_id, action, status, reason, created_at")
      .single();

    if (error) throw error;

    await supabase.from("sc_admin_audit_logs").insert({
      actor_discord_user_id: session!.userId,
      action: "leave_guild_requested",
      target_type: "guild",
      target_id: guildId,
      after_data: action,
      metadata: { reason: body.reason || null },
    });

    return NextResponse.json({ ok: true, action });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 400 },
    );
  }
}
