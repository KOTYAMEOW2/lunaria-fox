import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertGuildAccess } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  imageDataUrl: z.string().min(64).max(10_000_000),
  knownNames: z.array(z.string().min(1).max(120)).max(300).optional().default([]),
});

const rowSchema = z.object({
  character_name: z.string().min(1).max(120),
  matches_count: z.number().int().min(1).max(1000).default(1),
  kills: z.number().int().min(0).max(1_000_000),
  deaths: z.number().int().min(0).max(1_000_000),
  assists: z.number().int().min(0).max(1_000_000),
  treasury_spent: z.number().int().min(0).max(999_999_999),
  score: z.number().int().min(-999_999_999).max(999_999_999),
  confidence: z.number().min(0).max(1).default(0.5),
  notes: z.string().max(300).default(""),
});

const responseSchema = z.object({
  rows: z.array(rowSchema).max(300),
  warnings: z.array(z.string().max(300)).max(20).default([]),
});

function isAllowedImageDataUrl(value: string) {
  return /^data:image\/(png|jpe?g|webp);base64,/i.test(value);
}

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;

  const chunks: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

function parseJsonText(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI did not return JSON.");
    return JSON.parse(match[0]);
  }
}

function normalizeNumber(value: unknown) {
  const parsed = Number.parseInt(String(value ?? "0").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRows(rows: z.infer<typeof rowSchema>[]) {
  return rows
    .map((row) => ({
      character_name: row.character_name.replace(/\s+/g, " ").trim(),
      matches_count: Math.max(1, normalizeNumber(row.matches_count || 1)),
      kills: Math.max(0, normalizeNumber(row.kills)),
      deaths: Math.max(0, normalizeNumber(row.deaths)),
      assists: Math.max(0, normalizeNumber(row.assists)),
      treasury_spent: Math.max(0, normalizeNumber(row.treasury_spent)),
      score: normalizeNumber(row.score),
      confidence: Math.max(0, Math.min(1, Number(row.confidence || 0))),
      notes: String(row.notes || "").slice(0, 300),
    }))
    .filter((row) => row.character_name.length > 0);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const session = await getSession();
    const { guildId } = await params;
    await assertGuildAccess(session, guildId);

    const payload = requestSchema.parse(await request.json());
    if (!isAllowedImageDataUrl(payload.imageDataUrl)) {
      return NextResponse.json({ error: "Поддерживаются только PNG, JPG/JPEG и WEBP." }, { status: 415 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY не задан в переменных сайта." }, { status: 503 });
    }

    const knownNames = payload.knownNames
      .map((name) => name.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 300);

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CW_TABLE_MODEL || "gpt-4o-mini",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "Ты извлекаешь таблицу результатов STALCRAFT:X Clan War из скриншота. Верни только JSON. Не выдумывай строки. Если число или ник нечитабельны — пропусти строку или добавь предупреждение.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "Нужно распознать таблицу КВ.",
                  "Колонки обычно: ник, убийства, смерти, ассисты, потраченная казна, счёт.",
                  "Если есть колонка количества боёв/табов — запиши её в matches_count, иначе matches_count=1.",
                  "Числа с пробелами внутри считай одним числом: 1 234 = 1234.",
                  "Сохраняй ники максимально точно.",
                  knownNames.length ? `Известные игроки для сверки: ${knownNames.join(", ")}` : "Известных игроков для сверки нет.",
                ].join("\n"),
              },
              {
                type: "input_image",
                image_url: payload.imageDataUrl,
                detail: "high",
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "stalcraft_cw_table",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["rows", "warnings"],
              properties: {
                rows: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["character_name", "matches_count", "kills", "deaths", "assists", "treasury_spent", "score", "confidence", "notes"],
                    properties: {
                      character_name: { type: "string" },
                      matches_count: { type: "integer" },
                      kills: { type: "integer" },
                      deaths: { type: "integer" },
                      assists: { type: "integer" },
                      treasury_spent: { type: "integer" },
                      score: { type: "integer" },
                      confidence: { type: "number" },
                      notes: { type: "string" }
                    }
                  }
                },
                warnings: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
          }
        },
        max_output_tokens: 6000,
      }),
    });

    const raw = await openaiResponse.json().catch(() => null);
    if (!openaiResponse.ok) {
      return NextResponse.json(
        { error: raw?.error?.message || `OpenAI request failed: ${openaiResponse.status}` },
        { status: 502 },
      );
    }

    const extracted = responseSchema.parse(parseJsonText(extractOutputText(raw)));

    return NextResponse.json({
      ok: true,
      rows: normalizeRows(extracted.rows),
      warnings: extracted.warnings,
      model: raw?.model || process.env.OPENAI_CW_TABLE_MODEL || "gpt-4o-mini",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI table extraction failed" },
      { status: 400 },
    );
  }
}
