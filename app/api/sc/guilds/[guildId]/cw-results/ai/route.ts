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

const responseJsonSchema = {
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
} as const;

type Row = z.infer<typeof rowSchema>;
type AgentPayload = z.infer<typeof schema>;
type AgentResult = z.infer<typeof aiResponseSchema>;
type AiProvider = "auto" | "ollama" | "openai" | "hf";

function aiProvider(): AiProvider {
  const value = String(process.env.CW_TABS_AI_PROVIDER || "auto").trim().toLowerCase();
  if (value === "ollama" || value === "openai" || value === "hf") return value;
  return "auto";
}

function openAiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

function openAiModel() {
  return String(process.env.OPENAI_CW_TABS_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
}

function huggingFaceToken() {
  return String(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || "").trim();
}

function huggingFaceModel() {
  return String(process.env.HF_CW_TABS_MODEL || "Qwen/Qwen2.5-VL-7B-Instruct").trim();
}

function huggingFaceProvider() {
  return String(process.env.HF_INFERENCE_PROVIDER || "auto").trim();
}

function ollamaBaseUrl() {
  return String(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/api").replace(/\/+$/, "");
}

function ollamaVisionModel() {
  return String(process.env.OLLAMA_CW_TABS_MODEL || "qwen2.5vl:7b").trim();
}

function normalizeNameKey(value: string) {
  return String(value || "")
    .toLocaleLowerCase("ru")
    .replace(/[_\s.-]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
}

function scoreRow(row: Row, knownNames: Set<string>) {
  let score = 0;
  const nameKey = normalizeNameKey(row.character_name);
  if (nameKey.length >= 3) score += 16;
  if (knownNames.size > 0 && knownNames.has(nameKey)) score += 22;
  if (/\d$/.test(row.character_name.trim())) score -= 10;

  if (row.kills >= 0 && row.kills <= 20) score += 18; else score -= 16;
  if (row.deaths >= 0 && row.deaths <= 20) score += 18; else score -= 16;
  if (row.assists >= 0 && row.assists <= 20) score += 18; else score -= 16;

  if (row.treasury_spent >= 100 && row.treasury_spent <= 100_000) score += 20;
  else if (row.treasury_spent > 0 && row.treasury_spent <= 250_000) score += 8;
  else score -= 12;

  if (row.score >= 100 && row.score <= 10_000) score += 22;
  else if (row.score > 0 && row.score <= 25_000) score += 8;
  else if (row.score === 0 && row.treasury_spent > 0) score -= 18;
  else score -= 10;

  const kd = row.deaths === 0 ? row.kills : row.kills / Math.max(1, row.deaths);
  if (kd <= 8) score += 8;
  else score -= 10;

  return score;
}

function scoreRows(rows: Row[], knownNames: string[] = []) {
  if (!rows.length) return Number.NEGATIVE_INFINITY;
  const knownSet = new Set(knownNames.map(normalizeNameKey).filter(Boolean));
  const rowScore = rows.reduce((sum, row) => sum + scoreRow(row, knownSet), 0);
  const duplicates = rows.length - new Set(rows.map((row) => normalizeNameKey(row.character_name))).size;
  const zeroScores = rows.filter((row) => row.score === 0 && row.treasury_spent > 0).length;
  const hugeTreasury = rows.filter((row) => row.treasury_spent > 120_000).length;
  return rowScore + rows.length * 28 - duplicates * 14 - zeroScores * 18 - hugeTreasury * 10;
}

function chooseBetterRows(currentRows: Row[], candidateRows: Row[], knownNames: string[] = []) {
  const currentScore = scoreRows(currentRows, knownNames);
  const candidateScore = scoreRows(candidateRows, knownNames);
  return candidateScore > currentScore + 6 ? candidateRows : currentRows;
}

function dataUrlToBase64(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

function sanitizeRows(rows: Row[]) {
  const deduped = new Map<string, Row>();
  for (const row of rows) {
    const key = normalizeNameKey(row.character_name);
    if (!key) continue;
    const normalized: Row = {
      character_name: row.character_name.trim(),
      matches_count: Math.max(1, Number(row.matches_count || 1)),
      kills: Math.max(0, Number(row.kills || 0)),
      deaths: Math.max(0, Number(row.deaths || 0)),
      assists: Math.max(0, Number(row.assists || 0)),
      treasury_spent: Math.max(0, Number(row.treasury_spent || 0)),
      score: Math.max(0, Number(row.score || 0)),
    };

    const current = deduped.get(key);
    if (!current || scoreRows([normalized]) > scoreRows([current])) {
      deduped.set(key, normalized);
    }
  }
  return [...deduped.values()];
}

async function callOpenAi(payload: AgentPayload): Promise<AgentResult> {
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
        "Main priority is the right scoreboard table only.",
        "If full screenshot and cropped table conflict, trust the cropped table.",
        "Do not use rank words as names or stats.",
        payload.knownNames?.length
          ? `Known clan nicknames to prefer when the image is close: ${JSON.stringify(payload.knownNames.slice(0, 120))}`
          : "Known clan nicknames were not provided.",
        `OCR draft rows: ${JSON.stringify((payload.ocrRows || []).slice(0, 80))}`,
      ].join("\n"),
    },
  ];

  if (payload.tableImageDataUrl) {
    userContent.push({ type: "text", text: "Focused crop of the scoreboard table." });
    userContent.push({ type: "image_url", image_url: { url: payload.tableImageDataUrl, detail: "high" } });
  }
  if (payload.processedTableImageDataUrl) {
    userContent.push({ type: "text", text: "High-contrast crop of the same table." });
    userContent.push({ type: "image_url", image_url: { url: payload.processedTableImageDataUrl, detail: "high" } });
  }
  userContent.push({ type: "text", text: "Full screenshot for context." });
  userContent.push({ type: "image_url", image_url: { url: payload.imageDataUrl, detail: "high" } });

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
          schema: responseJsonSchema,
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You extract STALCRAFT:X clan war scoreboard rows. Return only visible player rows. Columns are player nickname, kills/У, deaths/С, assists/П, treasury/Казна, score/Счет/Счёт. Ignore rank, team panels, headings and totals. Prefer the focused table crop over the full screenshot. If a value is unreadable, omit that row instead of guessing.",
        },
        { role: "user", content: userContent },
      ],
    }),
  });

  const text = await response.text();
  let parsedBody: unknown = null;
  try {
    parsedBody = JSON.parse(text);
  } catch {
    parsedBody = null;
  }
  if (!response.ok) {
    const message = (parsedBody as any)?.error?.message || `OpenAI request failed: ${response.status}`;
    throw new Error(message);
  }

  const content = (parsedBody as { choices?: Array<{ message?: { content?: string } }> } | null)?.choices?.[0]?.message?.content || "{}";
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  return aiResponseSchema.parse(parsed);
}

async function callHuggingFace(payload: AgentPayload): Promise<AgentResult> {
  const token = huggingFaceToken();
  if (!token) throw new Error("HF_TOKEN is not configured.");

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: [
        "Read this STALCRAFT CW tab and correct OCR if needed.",
        "Return JSON rows with: character_name, matches_count, kills, deaths, assists, treasury_spent, score.",
        "Main priority is the right scoreboard table only.",
        "If full screenshot and cropped table conflict, trust the cropped table.",
        "Do not use rank words as names or stats.",
        payload.knownNames?.length
          ? `Known clan nicknames to prefer when the image is close: ${JSON.stringify(payload.knownNames.slice(0, 120))}`
          : "Known clan nicknames were not provided.",
        `OCR draft rows: ${JSON.stringify((payload.ocrRows || []).slice(0, 80))}`,
      ].join("\n"),
    },
  ];

  if (payload.tableImageDataUrl) {
    userContent.push({ type: "text", text: "Focused crop of the scoreboard table." });
    userContent.push({ type: "image_url", image_url: { url: payload.tableImageDataUrl } });
  }
  if (payload.processedTableImageDataUrl) {
    userContent.push({ type: "text", text: "High-contrast crop of the same table." });
    userContent.push({ type: "image_url", image_url: { url: payload.processedTableImageDataUrl } });
  }
  userContent.push({ type: "text", text: "Full screenshot for context." });
  userContent.push({ type: "image_url", image_url: { url: payload.imageDataUrl } });

  const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: huggingFaceModel(),
      provider: huggingFaceProvider(),
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "stalcraft_cw_tabs",
          strict: true,
          schema: responseJsonSchema,
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You extract STALCRAFT:X clan war scoreboard rows. Return only visible player rows. Columns are player nickname, kills/У, deaths/С, assists/П, treasury/Казна, score/Счет/Счёт. Ignore rank, team panels, headings and totals. Prefer the focused table crop over the full screenshot. If a value is unreadable, omit that row instead of guessing.",
        },
        { role: "user", content: userContent },
      ],
    }),
  });

  const text = await response.text();
  let parsedBody: unknown = null;
  try {
    parsedBody = JSON.parse(text);
  } catch {
    parsedBody = null;
  }
  if (!response.ok) {
    const message = (parsedBody as any)?.error?.message || (parsedBody as any)?.error || `Hugging Face request failed: ${response.status}`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  const content = (parsedBody as { choices?: Array<{ message?: { content?: string } }> } | null)?.choices?.[0]?.message?.content || "{}";
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  return aiResponseSchema.parse(parsed);
}

async function callOllamaVision(prompt: string, images: string[]): Promise<AgentResult> {
  const response = await fetch(`${ollamaBaseUrl()}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: ollamaVisionModel(),
      stream: false,
      format: responseJsonSchema,
      options: {
        temperature: 0,
        num_ctx: 8192,
      },
      messages: [
        {
          role: "system",
          content:
            "You are a STALCRAFT scoreboard extraction agent. Return only valid JSON matching the schema. Read only the visible right-side scoreboard table. Ignore rank and all panels outside the table.",
        },
        {
          role: "user",
          content: prompt,
          images,
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
    const message = (payload as any)?.error || `Ollama request failed: ${response.status}`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  const content = (payload as { message?: { content?: string } } | null)?.message?.content || "{}";
  return aiResponseSchema.parse(JSON.parse(content));
}

async function runOllamaAgent(payload: AgentPayload): Promise<AgentResult> {
  const notes: string[] = [`Локальный AI-агент: ${ollamaVisionModel()}.`];
  const focusedImages = [
    payload.processedTableImageDataUrl,
    payload.tableImageDataUrl,
    payload.imageDataUrl,
  ].filter((value): value is string => Boolean(value)).map(dataUrlToBase64);

  let bestRows = sanitizeRows(payload.ocrRows || []);

  const extractPrompt = [
    "Extract visible STALCRAFT scoreboard rows from the focused table.",
    "Columns are: nickname, kills, deaths, assists, treasury, score.",
    "Ignore rank.",
    "Prefer the processed and cropped table images over the full screenshot.",
    payload.knownNames?.length
      ? `Known nicknames to prefer when close: ${JSON.stringify(payload.knownNames.slice(0, 120))}`
      : "Known nicknames were not provided.",
    `OCR draft rows: ${JSON.stringify((payload.ocrRows || []).slice(0, 80))}`,
  ].join("\n");

  try {
    const extracted = await callOllamaVision(extractPrompt, focusedImages);
    bestRows = chooseBetterRows(bestRows, sanitizeRows(extracted.rows), payload.knownNames || []);
    if (Array.isArray(extracted.notes)) notes.push(...extracted.notes);
  } catch (error) {
    notes.push(`Локальное извлечение таблицы не удалось: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  const reconcilePrompt = [
    "You are validating a STALCRAFT scoreboard extraction.",
    "Re-read the table carefully and fix any wrong column shifts.",
    "Common mistakes to fix: kills swapped with deaths, assists shifted, treasury merged with score, or nickname partially broken.",
    payload.knownNames?.length
      ? `Known nicknames to prefer when one character is unclear: ${JSON.stringify(payload.knownNames.slice(0, 120))}`
      : "Known nicknames were not provided.",
    `Current best rows: ${JSON.stringify(bestRows.slice(0, 80))}`,
    `Original OCR draft rows: ${JSON.stringify((payload.ocrRows || []).slice(0, 80))}`,
  ].join("\n");

  try {
    const reconciled = await callOllamaVision(reconcilePrompt, focusedImages);
    bestRows = chooseBetterRows(bestRows, sanitizeRows(reconciled.rows), payload.knownNames || []);
    if (Array.isArray(reconciled.notes)) notes.push(...reconciled.notes);
  } catch (error) {
    notes.push(`Локальная проверка таблицы не удалась: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  return {
    rows: bestRows,
    notes: notes.slice(0, 20),
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const session = await getSession();
    const { guildId } = await params;
    await assertGuildAccess(session, guildId);

    const payload = schema.parse(await request.json());
    const provider = aiProvider();

    if (provider === "ollama") {
      const result = await runOllamaAgent(payload);
      return NextResponse.json({ ok: true, provider: "ollama", ...result });
    }

    if (provider === "openai") {
      const result = await callOpenAi(payload);
      return NextResponse.json({ ok: true, provider: "openai", ...result });
    }

    if (provider === "hf") {
      const result = await callHuggingFace(payload);
      return NextResponse.json({ ok: true, provider: "hf", ...result });
    }

    try {
      const result = await runOllamaAgent(payload);
      if (result.rows.length > 0) {
        return NextResponse.json({ ok: true, provider: "ollama", ...result });
      }
    } catch {}

    if (huggingFaceToken()) {
      const result = await callHuggingFace(payload);
      return NextResponse.json({ ok: true, provider: "hf", ...result });
    }

    if (openAiKey()) {
      const result = await callOpenAi(payload);
      return NextResponse.json({ ok: true, provider: "openai", ...result });
    }

    return NextResponse.json(
      {
        error: "No AI provider is configured. Start Ollama with a vision model or configure OPENAI_API_KEY.",
        rows: [],
      },
      { status: 501 },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI tab parsing failed", rows: [] }, { status: 400 });
  }
}
