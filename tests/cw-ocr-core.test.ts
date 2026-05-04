import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeCwRows, type CwResultRow } from "../lib/stalcraft/cw-ocr-core.ts";

const knownRoster = [
  "ХИТРО БТ",
  "Великий_Чонгук",
  "Варип_привет",
  "Боевая_чебупеля",
  "Valtily",
  "Inari_fox",
  "Север_жив",
  "Azy_Literov",
  "Why_you_die",
  "Дайшма_лий",
];

const noisyRows: CwResultRow[] = [
  { character_name: "Why_you_die", matches_count: 1, kills: 0, deaths: 8, assists: 0, treasury_spent: 1826, score: 9701 },
  { character_name: "Hdadwma_nyi", matches_count: 1, kills: 0, deaths: 5, assists: 1, treasury_spent: 793, score: 5600 },
  { character_name: "Manty", matches_count: 1, kills: 3, deaths: 7, assists: 2, treasury_spent: 81002, score: 5100 },
  { character_name: "Великий_Чонгук", matches_count: 1, kills: 6, deaths: 7, assists: 1, treasury_spent: 12456, score: 4210 },
  { character_name: "Варип_привет", matches_count: 1, kills: 6, deaths: 5, assists: 2, treasury_spent: 32210, score: 3550 },
  { character_name: "Боевая_чебупеля", matches_count: 1, kills: 7, deaths: 6, assists: 1, treasury_spent: 2830, score: 3205 },
  { character_name: "ХИТРО БТ", matches_count: 1, kills: 4, deaths: 5, assists: 0, treasury_spent: 58104, score: 2100 },
  { character_name: "fmari_fox", matches_count: 1, kills: 0, deaths: 5, assists: 4, treasury_spent: 8924, score: 1710 },
  { character_name: "Bry_Literoy", matches_count: 1, kills: 1, deaths: 8, assists: 2, treasury_spent: 14125, score: 1261 },
  { character_name: "Север_жив", matches_count: 1, kills: 0, deaths: 7, assists: 2, treasury_spent: 964, score: 1206 },
];

test("sanitizeCwRows snaps obvious OCR nicknames to roster", () => {
  const result = sanitizeCwRows(noisyRows, knownRoster);
  const names = result.rows.map((row) => row.character_name);

  assert.ok(names.includes("Why_you_die"));
  assert.ok(names.includes("Великий_Чонгук"));
  assert.ok(names.includes("Варип_привет"));
  assert.ok(names.includes("Боевая_чебупеля"));
  assert.ok(names.includes("ХИТРО БТ"));
  assert.ok(names.includes("Север_жив"));
  assert.ok(names.includes("Inari_fox"));
  assert.ok(names.includes("Azy_Literov"));
  assert.ok(names.includes("Дайшма_лий"));
});

test("sanitizeCwRows repairs at least part of treasury/score drift", () => {
  const result = sanitizeCwRows(noisyRows, knownRoster);
  const rowsByName = new Map(result.rows.map((row) => [row.character_name, row]));

  assert.ok((rowsByName.get("ХИТРО БТ")?.treasury_spent || 0) < 58104);
  assert.ok((rowsByName.get("Valtily")?.treasury_spent || 0) < 81002);
  assert.ok((rowsByName.get("Azy_Literov")?.score || 0) !== 1261);
});
