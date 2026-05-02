import { ImageResponse } from "next/og";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SquadRow = {
  id: string;
  name: string;
  description: string | null;
  voice_channel_id: string | null;
};

function chunkText(value: string, max = 34) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function formatMsk(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function readSquadData(guildId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { guild: null, settings: null, squads: [] as SquadRow[], members: [] as any[] };
  }

  const [{ data: guild }, { data: settings }, { data: squads }] = await Promise.all([
    supabase.from("sc_guilds").select("guild_id, name").eq("guild_id", guildId).maybeSingle(),
    supabase.from("sc_guild_settings").select("clan_name, community_name").eq("guild_id", guildId).maybeSingle(),
    supabase.from("sc_cw_squads").select("*").eq("guild_id", guildId).order("created_at", { ascending: true }),
  ]);

  const squadRows = (squads || []) as SquadRow[];
  const squadIds = squadRows.map((squad) => squad.id);
  const { data: members } = squadIds.length
    ? await supabase.from("sc_cw_squad_members").select("*").in("squad_id", squadIds).order("created_at")
    : { data: [] as any[] };

  return { guild, settings, squads: squadRows, members: (members || []) as any[] };
}

export async function GET(_request: Request, { params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { guild, settings, squads, members } = await readSquadData(guildId);
  const bySquad = new Map<string, any[]>();
  for (const member of members) {
    bySquad.set(member.squad_id, [...(bySquad.get(member.squad_id) || []), member]);
  }

  const height = Math.max(720, Math.min(1600, 300 + Math.max(1, squads.length) * 160));
  const title = settings?.clan_name || settings?.community_name || guild?.name || "STALCRAFT Squad Table";
  const totalPlayers = members.length;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "54px",
          color: "#fff8ea",
          background:
            "radial-gradient(circle at 18% 8%, rgba(155,124,255,.34), transparent 34%), radial-gradient(circle at 78% 22%, rgba(136,255,192,.18), transparent 32%), linear-gradient(135deg, #030706 0%, #0a0615 55%, #010302 100%)",
          fontFamily: "Arial",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "28px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                width: "max-content",
                padding: "10px 16px",
                borderRadius: "999px",
                border: "1px solid rgba(136,255,192,.42)",
                color: "#aaffd6",
                fontSize: 22,
                letterSpacing: ".16em",
                textTransform: "uppercase",
              }}
            >
              CW Squads
            </div>
            <div style={{ fontSize: 58, fontWeight: 900, lineHeight: 1.02 }}>
              {chunkText(title, 34)}
            </div>
            <div style={{ color: "#d7caff", fontSize: 24 }}>
              Таблица отрядов для КВ · {guild?.name || guildId}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "8px",
              padding: "18px 22px",
              borderRadius: 28,
              border: "1px solid rgba(229,221,255,.16)",
              background: "rgba(8, 5, 18, .74)",
            }}
          >
            <div style={{ color: "#bcb2d7", fontSize: 20 }}>Обновлено</div>
            <div style={{ color: "#ffd37a", fontSize: 32, fontWeight: 900 }}>{formatMsk(new Date().toISOString())} МСК</div>
            <div style={{ color: "#aaffd6", fontSize: 20 }}>{squads.length} отряд(ов) · {totalPlayers} игрок(ов)</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "22px",
            marginTop: "38px",
          }}
        >
          {squads.length > 0 ? squads.slice(0, 7).map((squad, index) => {
            const assigned = bySquad.get(squad.id) || [];
            const visible = assigned.slice(0, 8);
            return (
              <div
                key={squad.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "610px",
                  minHeight: 132,
                  padding: "22px",
                  borderRadius: 28,
                  border: "1px solid rgba(155,124,255,.42)",
                  background: "linear-gradient(135deg, rgba(14, 9, 31, .92), rgba(2, 12, 9, .78))",
                  boxShadow: "0 18px 44px rgba(0,0,0,.34)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        color: "#050806",
                        background: "linear-gradient(135deg, #8dffa8, #ffd37a)",
                        fontWeight: 900,
                      }}
                    >
                      {index + 1}
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 900 }}>{chunkText(squad.name, 23)}</div>
                  </div>
                  <div style={{ color: "#aaffd6", fontSize: 22, fontWeight: 800 }}>{assigned.length} ppl</div>
                </div>
                {squad.description ? (
                  <div style={{ marginTop: "10px", color: "#cfc4e8", fontSize: 18 }}>{chunkText(squad.description, 72)}</div>
                ) : null}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "18px" }}>
                  {visible.length > 0 ? visible.map((member) => (
                    <div
                      key={`${squad.id}-${member.discord_user_id}`}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        color: "#fff8ea",
                        background: "rgba(229,221,255,.10)",
                        border: "1px solid rgba(229,221,255,.14)",
                        fontSize: 18,
                      }}
                    >
                      {chunkText(member.character_name || member.discord_user_id, 22)}
                    </div>
                  )) : (
                    <div style={{ color: "#b9accf", fontSize: 20 }}>Игроки ещё не назначены</div>
                  )}
                  {assigned.length > visible.length ? (
                    <div style={{ color: "#ffd37a", fontSize: 18 }}>+{assigned.length - visible.length}</div>
                  ) : null}
                </div>
              </div>
            );
          }) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                padding: "34px",
                borderRadius: 28,
                border: "1px solid rgba(155,124,255,.42)",
                background: "rgba(14, 9, 31, .82)",
                color: "#d7caff",
                fontSize: 28,
              }}
            >
              Отряды ещё не созданы. Офицер может создать первый отряд на сайте.
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: 1400,
      height,
      headers: {
        "cache-control": "public, max-age=60, s-maxage=60",
      },
    },
  );
}
