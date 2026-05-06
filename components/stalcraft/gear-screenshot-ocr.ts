import type { StalcraftCharacterCacheRow } from "@/lib/stalcraft/types";

export type GearScreenshotSearchResult = {
  itemId: string;
  itemName: string;
  itemNameRu?: string | null;
  itemNameEn?: string | null;
  slot: "weapon" | "armor";
  category: string;
  rank: string | null;
  wikiUrl: string;
  exact: boolean;
  score: number;
};

type OcrVariant = {
  key: string;
  mode: "nick" | "item" | "full";
  image: HTMLCanvasElement;
};

type OcrTextResult = {
  key: string;
  mode: "nick" | "item" | "full";
  text: string;
};

type NicknameMatch = {
  score: number;
  line: string;
  character: StalcraftCharacterCacheRow;
};

type ItemMatch = {
  score: number;
  line: string;
  slot: "weapon" | "armor";
  item: GearScreenshotSearchResult;
  exact: boolean;
};

export type GearScreenshotAnalysis = {
  nicknameMatch: NicknameMatch | null;
  itemMatch: ItemMatch | null;
  recognized: OcrTextResult[];
};

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeNickname(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[\s_.\-]+/g, "")
    .replace(/[^a-z0-9а-я]+/gi, "")
    .trim();
}

function boundedLevenshtein(a: string, b: string, maxDistance = 3) {
  if (a === b) return 0;
  if (!a || !b) return Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) > maxDistance) return null;

  const prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  const next = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    next[0] = i;
    let rowMin = next[0];

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      next[j] = Math.min(prev[j] + 1, next[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, next[j]);
    }

    if (rowMin > maxDistance) return null;
    for (let j = 0; j <= b.length; j += 1) prev[j] = next[j];
  }

  return prev[b.length] <= maxDistance ? prev[b.length] : null;
}

function scoreNicknameMatch(candidate: string, target: string) {
  const left = normalizeNickname(candidate);
  const right = normalizeNickname(target);
  if (!left || !right) return 0;
  if (left === right) return 1000;
  if (left.includes(right) || right.includes(left)) return 900 - Math.abs(left.length - right.length) * 20;

  const distance = boundedLevenshtein(left, right, 3);
  if (distance !== null) return 760 - distance * 80;
  return 0;
}

function splitLines(text: string) {
  return String(text || "")
    .split(/\r?\n/g)
    .map((line) => cleanText(line))
    .filter(Boolean) as string[];
}

function uniq<T>(values: T[]) {
  return [...new Set(values)];
}

function cleanItemCandidate(value: string) {
  return String(value || "")
    .replace(/\|\s*\+\d+.*$/u, "")
    .replace(/\+\d+.*$/u, "")
    .replace(/[|¦]+.*$/u, "")
    .replace(/^[^\p{L}\p{N}«"<]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulItemLine(value: string) {
  const line = cleanItemCandidate(value);
  if (!line || line.length < 3) return false;
  if (/^(персональный предмет|ранг|класс|вес|прочность|владелец|итоговые характеристики|урон|тип боеприпасов|объем магазина|магазина|скорострельность|перезарядка|тактическая перезарядка|эргономика оружия|разброс|вертикальная отдача|горизонтальная отдача|скорость передвижения|выносливость|стойкость)$/i.test(line)) {
    return false;
  }
  return /[a-zа-я0-9]/i.test(line);
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function applyThreshold(ctx: CanvasRenderingContext2D, width: number, height: number, threshold = 150) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const value = (data[i] + data[i + 1] + data[i + 2]) / 3 >= threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  ctx.putImageData(imageData, 0, 0);
}

async function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Не удалось открыть изображение."));
      img.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function buildVariants(file: File): Promise<OcrVariant[]> {
  const image = await loadImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error("У изображения нет корректного размера.");

  const crops = [
    { key: "nick-tight", mode: "nick" as const, box: { x: 0.50, y: 0.09, w: 0.19, h: 0.07 } },
    { key: "nick-wide", mode: "nick" as const, box: { x: 0.48, y: 0.08, w: 0.27, h: 0.12 } },
    { key: "item-tight", mode: "item" as const, box: { x: 0.66, y: 0.16, w: 0.24, h: 0.38 } },
    { key: "item-wide", mode: "item" as const, box: { x: 0.60, y: 0.12, w: 0.33, h: 0.56 } },
    { key: "right-pane", mode: "item" as const, box: { x: 0.50, y: 0.06, w: 0.42, h: 0.78 } },
    { key: "full", mode: "full" as const, box: { x: 0, y: 0, w: 1, h: 1 } },
  ];

  const variants: OcrVariant[] = [];
  for (const crop of crops) {
    const sx = Math.max(0, Math.floor(width * crop.box.x));
    const sy = Math.max(0, Math.floor(height * crop.box.y));
    const sw = Math.min(width - sx, Math.max(1, Math.floor(width * crop.box.w)));
    const sh = Math.min(height - sy, Math.max(1, Math.floor(height * crop.box.h)));
    const targetWidth = Math.max(900, sw * 2);
    const targetHeight = Math.max(300, Math.floor((sh / sw) * targetWidth));

    const softCanvas = createCanvas(targetWidth, targetHeight);
    const softCtx = softCanvas.getContext("2d");
    if (!softCtx) throw new Error("Canvas OCR не инициализировался.");
    softCtx.filter = "grayscale(1) contrast(1.35) brightness(1.08)";
    softCtx.drawImage(image, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    softCtx.filter = "none";
    variants.push({ key: `${crop.key}-soft`, mode: crop.mode, image: softCanvas });

    const hardCanvas = createCanvas(targetWidth, targetHeight);
    const hardCtx = hardCanvas.getContext("2d");
    if (!hardCtx) throw new Error("Canvas OCR не инициализировался.");
    hardCtx.filter = "grayscale(1) contrast(1.6) brightness(1.12)";
    hardCtx.drawImage(image, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    hardCtx.filter = "none";
    applyThreshold(hardCtx, targetWidth, targetHeight, 150);
    variants.push({ key: `${crop.key}-hard`, mode: crop.mode, image: hardCanvas });
  }

  return variants;
}

function matchNickname(recognized: OcrTextResult[], characters: StalcraftCharacterCacheRow[]) {
  const lines = recognized
    .filter((entry) => entry.mode === "nick" || entry.mode === "full")
    .flatMap((entry) => splitLines(entry.text));

  let best: NicknameMatch | null = null;
  for (const line of uniq(lines)) {
    for (const character of characters) {
      const score = scoreNicknameMatch(line, character.character_name);
      if (!best || score > best.score) {
        best = { score, line, character };
      }
    }
  }

  return best && best.score >= 720 ? best : null;
}

async function matchItem(
  recognized: OcrTextResult[],
  searchOfficial: (query: string, slot?: "weapon" | "armor" | null) => Promise<GearScreenshotSearchResult[]>,
  slotHint: "weapon" | "armor" | null,
) {
  const lines = recognized
    .filter((entry) => entry.mode === "item" || entry.mode === "full")
    .flatMap((entry) => splitLines(entry.text))
    .map((line) => cleanItemCandidate(line))
    .filter(isUsefulItemLine);

  let best: ItemMatch | null = null;
  const slots = slotHint ? [slotHint] : (["weapon", "armor"] as const);

  for (const line of uniq(lines)) {
    for (const slot of slots) {
      const matches = await searchOfficial(line, slot);
      const top = matches[0];
      if (!top) continue;

      if (!best || top.score > best.score) {
        best = {
          score: top.score,
          line,
          slot,
          item: top,
          exact: top.exact,
        };
      }
    }
  }

  return best && best.score >= 700 ? best : null;
}

export async function analyzeGearScreenshotInBrowser({
  file,
  characters,
  searchOfficial,
  slotHint = null,
}: {
  file: File;
  characters: StalcraftCharacterCacheRow[];
  searchOfficial: (query: string, slot?: "weapon" | "armor" | null) => Promise<GearScreenshotSearchResult[]>;
  slotHint?: "weapon" | "armor" | null;
}): Promise<GearScreenshotAnalysis> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng+rus");

  try {
    const variants = await buildVariants(file);
    const recognized: OcrTextResult[] = [];

    for (const variant of variants) {
      const params: Record<string, string> = {
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      };

      if (variant.mode === "nick") {
        params.tessedit_pageseg_mode = "7";
        params.tessedit_char_whitelist = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-.";
      } else {
        params.tessedit_pageseg_mode = variant.mode === "item" ? "6" : "11";
      }

      await worker.setParameters(params);
      const result = await worker.recognize(variant.image);
      recognized.push({
        key: variant.key,
        mode: variant.mode,
        text: cleanText(result?.data?.text) || "",
      });
    }

    const nicknameMatch = matchNickname(recognized, characters);
    const itemMatch = await matchItem(recognized, searchOfficial, slotHint);
    return { nicknameMatch, itemMatch, recognized };
  } finally {
    await worker.terminate().catch(() => {});
  }
}
