import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { searchOfficialStalcraftGear } from "@/lib/stalcraft/item-database";

const querySchema = z.object({
  q: z.string().min(2).max(120),
  slot: z.enum(["weapon", "armor"]).optional(),
  limit: z.coerce.number().int().min(1).max(12).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = querySchema.parse({
      q: request.nextUrl.searchParams.get("q") || "",
      slot: request.nextUrl.searchParams.get("slot") || undefined,
      limit: request.nextUrl.searchParams.get("limit") || undefined,
    });

    const results = await searchOfficialStalcraftGear(parsed.q, parsed.slot, parsed.limit || 6);
    return NextResponse.json({
      ok: true,
      results: results.map((entry) => ({
        itemId: entry.item.itemId,
        itemName: entry.item.itemName,
        itemNameRu: entry.item.itemNameRu,
        itemNameEn: entry.item.itemNameEn,
        slot: entry.item.slot,
        category: entry.item.category,
        rank: entry.item.rank,
        wikiUrl: entry.item.wikiUrl,
        exact: entry.exact,
        score: entry.score,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 400 });
  }
}
