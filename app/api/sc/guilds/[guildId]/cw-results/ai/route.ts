import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertGuildAccess } from "@/lib/auth/access";
import { getSession } from "@/lib/auth/session";

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
  imageDataUrl: z.string().startsWith("data:image/").max(12_000_000),
  tableImageDataUrl: z.string().startsWith("data:image/").max(12_000_000).optional(),
  processedTableImageDataUrl: z.string().startsWith("data:image/").max(12_000_000).optional(),
  ocrRows: z.array(rowSchema).max(300).optional(),
  knownNames: z.array(z.string().min(1).max(120)).max(200).optional(),
});

const aiResponseSchema = z.object({
  rows: z.array(rowSchema).max(300),
  notes: z.array(z.string()).max(20).optional(),
});

function openAiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

function openAiModel() {
  return String(process.env.OPENAI_CW_TABS_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
}

async function readOpenAiRows(
  imageDataUrl: string,
  ocrRows: z.infer<typeof rowSchema>[],
  options?: {
    tableImageDataUrl?: string;
    processedTableImageDataUrl?: string;
    knownNames?: string[];
  },
) {
  const key = openAiKey();
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" | "low" | "auto" } }
  > = [
    {
      type: "text",
      text: [
        "Read this STALCRAFT CW tab and correct OCR if needed.",
        "Return JSON rows with: character_name, matches_count, kills, deaths, assists, treasury_spent, score.",
        "matches_count is 1 for a single screenshot unless OCR rows already contain accumulated matches.",
        "Main priority is the right scoreboard table only.",
        "If full screenshot and cropped table conflict, trust the cropped table.",
        "Do not use rank words as names or stats.",
        "If OCR draft shows kills glued to the nickname or treasury/score shifted, fix the shift from the image.",
        options?.knownNames?.length
          ? `Known clan nicknames to prefer when the image is close: ${JSON.stringify(options.knownNames.slice(0, 120))}`
          : "Known clan nicknames were not provided.",
        `OCR draft rows: ${JSON.stringify(ocrRows.slice(0, 80))}`,
      ].join("\n"),
    },
  ];

  if (options?.tableImageDataUrl) {
    userContent.push({
      type: "text",
      text: "Focused crop of the scoreboard table.",
    });
    userContent.push({
      type: "image_url",
      image_url: { url: options.tableImageDataUrl, detail: "high" },
    });
  }

  if (options?.processedTableImageDataUrl) {
    userContent.push({
      type: "text",
      text: "High-contrast processed crop of the same scoreboard table for reading white text and digits.",
    });
    userContent.push({
      type: "image_url",
      image_url: { url: options.processedTableImageDataUrl, detail: "high" },
    });
  }

  userContent.push({
    type: "text",
    text: "Full screenshot for context.",
  });
  userContent.push({
    type: "image_url",
    image_url: { url: imageDataUrl, detail: "high" },
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: openAiModel(),
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "stalcraft_cw_tabs",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              rows: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    character_name: { type: "string" },
                    matches_count: { type: "integer" },
                    kills: { type: "integer" },
                    deaths: { type: "integer" },
                    assists: { type: "integer" },
                    treasury_spent: { type: "integer" },
                    score: { type: "integer" },
                  },
                  required: ["character_name", "matches_count", "kills", "deaths", "assists", "treasury_spent", "score"],
                },
              },
              notes: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["rows", "notes"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You extract STALCRAFT:X clan war scoreboard rows. Return only visible player rows. Columns are player nickname, kills/У, deaths/С, assists/П, treasury/Казна, score/Счет/Счёт. Ignore rank, team panels, headings and totals. Prefer the focused table crop over the full screenshot. Watch for OCR drafts where kills were glued to the nickname, or treasury and score were merged/split incorrectly. If a value is unreadable, omit that row instead of guessing.",
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = (payload as any)?.error?.message || `OpenAI request failed: ${response.status}`;
    throw new Error(message);
  }

  const content = (payload as { choices?: Array<{ message?: { content?: string } }> } | null)?.choices?.[0]?.message?.content || "{}";
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  return aiResponseSchema.parse(parsed);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const session = await getSession();
    const { guildId } = await params;
    await assertGuildAccess(session, guildId);

    if (!openAiKey()) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured.", rows: [] }, { status: 501 });
    }

    const payload = schema.parse(await request.json());
    const result = await readOpenAiRows(payload.imageDataUrl, payload.ocrRows || [], {
      tableImageDataUrl: payload.tableImageDataUrl,
      processedTableImageDataUrl: payload.processedTableImageDataUrl,
      knownNames: payload.knownNames,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI tab parsing failed", rows: [] }, { status: 400 });
  }
}
