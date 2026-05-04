export type CwResultRow = {
  character_name: string;
  matches_count: number;
  kills: number;
  deaths: number;
  assists: number;
  treasury_spent: number;
  score: number;
};

const OCR_IGNORED_ROW = /^(сводка|преимущество|захваченные|информация|ник|игрок|player|name|kills?|убийств|смерт|death|assist|казна|score|счет|счёт|ранг|k\/d|у\s+с\s+п)/i;

export function toInt(value: string | number | null | undefined) {
  const parsed = Number.parseInt(String(value ?? "0").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedPlayerKey(value: string) {
  return String(value || "")
    .toLocaleLowerCase("ru")
    .replace(/[_\s.-]+/g, " ")
    .trim();
}

function compactPlayerKey(value: string) {
  return normalizedPlayerKey(value)
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
}

function cleanPlayerName(value: string) {
  return String(value || "")
    .replace(/[|¦]/g, " ")
    .replace(/[^\p{L}\p{N}\s_[\].#-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeRealPlayerName(value: string) {
  const name = cleanPlayerName(value);
  if (!name || name.length < 2) return false;
  if (OCR_IGNORED_ROW.test(name)) return false;
  return /[\p{L}\p{N}]/u.test(name);
}

function rowSignalScore(row: CwResultRow) {
  return (
    Math.min(5, Math.max(1, row.matches_count || 1)) * 100_000_000_000
    + toInt(row.score) * 100_000
    + toInt(row.treasury_spent) * 100
    + toInt(row.kills) * 10
    + toInt(row.assists)
    - toInt(row.deaths)
  );
}

function normalizeOcrNumberToken(value: string) {
  return String(value || "")
    .replace(/[OoОо]/g, "0")
    .replace(/[IlІ|]/g, "1")
    .replace(/[Зз]/g, "3")
    .replace(/[Бб]/g, "6")
    .replace(/[^\d]/g, "");
}

function extractTrailingStandaloneStat(name: string) {
  const match = String(name || "").match(/^(.*?)(?:\s+)([\dOoОоIlІ|]{1,2})$/u);
  if (!match) return null;
  const tail = normalizeOcrNumberToken(match[2] || "");
  if (!tail && !/[OoОо]/.test(match[2] || "")) return null;

  return {
    character_name: match[1].trim(),
    value: Math.max(0, toInt(tail || "0")),
  };
}

function foldLatinCyrillicShapes(value: string) {
  return compactPlayerKey(value)
    .split("")
    .map((char) => {
      switch (char) {
        case "а":
        case "a": return "a";
        case "б":
        case "6": return "6";
        case "в":
        case "b": return "b";
        case "г":
        case "r": return "r";
        case "д":
        case "d":
        case "h": return "d";
        case "е":
        case "ё":
        case "e": return "e";
        case "ж":
        case "x": return "x";
        case "з":
        case "3":
        case "z": return "3";
        case "и":
        case "й":
        case "n":
        case "u": return "u";
        case "к":
        case "k": return "k";
        case "л":
        case "l": return "n";
        case "м":
        case "m": return "m";
        case "н": return "h";
        case "о":
        case "o":
        case "0":
        case "ф":
        case "q": return "o";
        case "п": return "n";
        case "р":
        case "p": return "p";
        case "с":
        case "c": return "c";
        case "т":
        case "t": return "t";
        case "у":
        case "y": return "y";
        case "ч":
        case "4": return "4";
        case "ш":
        case "щ":
        case "w": return "w";
        case "ы": return "bl";
        case "ь": return "";
        case "э": return "e";
        case "ю": return "io";
        case "я": return "r";
        case "i":
        case "1":
        case "j": return "i";
        case "f": return "f";
        case "v": return "v";
        case "g": return "g";
        default: return char;
      }
    })
    .join("");
}

function transliterateCyrillic(value: string) {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return normalizedPlayerKey(value)
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function levenshteinDistanceRaw(left: string, right: string) {
  if (!left) return right.length;
  if (!right) return left.length;
  const dp = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const temp = dp[j];
      dp[j] = left[i - 1] === right[j - 1]
        ? prev
        : Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      prev = temp;
    }
  }
  return dp[right.length];
}

function diceCoefficient(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const grams = (value: string) => {
    if (value.length < 2) return new Map([[value, 1]]);
    const result = new Map<string, number>();
    for (let index = 0; index < value.length - 1; index += 1) {
      const gram = value.slice(index, index + 2);
      result.set(gram, (result.get(gram) || 0) + 1);
    }
    return result;
  };

  const leftGrams = grams(left);
  const rightGrams = grams(right);
  let overlap = 0;
  for (const [gram, count] of leftGrams) {
    overlap += Math.min(count, rightGrams.get(gram) || 0);
  }

  return (2 * overlap) / (Math.max(1, left.length - 1) + Math.max(1, right.length - 1));
}

function nameSimilarity(raw: string, candidate: string) {
  const compactRaw = compactPlayerKey(raw);
  const compactCandidate = compactPlayerKey(candidate);
  if (!compactRaw || !compactCandidate) return 0;
  if (compactRaw === compactCandidate) return 1;

  const translitRaw = transliterateCyrillic(raw);
  const translitCandidate = transliterateCyrillic(candidate);
  const shapeRaw = foldLatinCyrillicShapes(raw);
  const shapeCandidate = foldLatinCyrillicShapes(candidate);

  const compactDice = diceCoefficient(compactRaw, compactCandidate);
  const translitDice = diceCoefficient(translitRaw, translitCandidate);
  const shapeDice = diceCoefficient(shapeRaw, shapeCandidate);

  const compactEdit = 1 - (levenshteinDistanceRaw(compactRaw, compactCandidate) / Math.max(compactRaw.length, compactCandidate.length, 1));
  const translitEdit = 1 - (levenshteinDistanceRaw(translitRaw, translitCandidate) / Math.max(translitRaw.length, translitCandidate.length, 1));
  const shapeEdit = 1 - (levenshteinDistanceRaw(shapeRaw, shapeCandidate) / Math.max(shapeRaw.length, shapeCandidate.length, 1));

  let score = Math.max(
    compactDice * 0.55 + compactEdit * 0.45,
    translitDice * 0.55 + translitEdit * 0.45,
    shapeDice * 0.6 + shapeEdit * 0.4,
  );

  if (compactCandidate.includes(compactRaw) || compactRaw.includes(compactCandidate)) score += 0.08;
  if (translitCandidate.includes(translitRaw) || translitRaw.includes(translitCandidate)) score += 0.08;
  return Math.min(1, score);
}

function assignRowsToRoster(rows: CwResultRow[], knownNames: string[]) {
  const names = [...new Set(knownNames.map((name) => cleanPlayerName(name)).filter(Boolean))];
  if (rows.length === 0 || names.length === 0) return { rows, snapped: 0 };

  const scores = rows.map((row) =>
    names
      .map((name, index) => ({ index, name, score: nameSimilarity(row.character_name, name) }))
      .sort((a, b) => b.score - a.score),
  );

  const assignedRows = new Set<number>();
  const assignedNames = new Set<number>();
  const replacements = new Map<number, string>();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const best = scores[rowIndex][0];
    const second = scores[rowIndex][1];
    const gap = (best?.score || 0) - (second?.score || 0);
    if (!best) continue;
    if ((best.score >= 0.93 || (best.score >= 0.8 && gap >= 0.18)) && !assignedNames.has(best.index)) {
      assignedRows.add(rowIndex);
      assignedNames.add(best.index);
      replacements.set(rowIndex, best.name);
    }
  }

  const remainingPairs = rows.flatMap((row, rowIndex) => {
    if (assignedRows.has(rowIndex)) return [];
    return scores[rowIndex]
      .filter((candidate) => !assignedNames.has(candidate.index))
      .slice(0, 4)
      .map((candidate) => ({ rowIndex, ...candidate }));
  }).sort((a, b) => b.score - a.score);

  for (const pair of remainingPairs) {
    if (assignedRows.has(pair.rowIndex) || assignedNames.has(pair.index)) continue;
    if (pair.score < 0.34) continue;
    assignedRows.add(pair.rowIndex);
    assignedNames.add(pair.index);
    replacements.set(pair.rowIndex, pair.name);
  }

  const leftoverRows = rows.map((_, index) => index).filter((index) => !assignedRows.has(index));
  const leftoverNames = names.map((_, index) => index).filter((index) => !assignedNames.has(index));
  if (leftoverRows.length > 0 && leftoverRows.length === leftoverNames.length && leftoverRows.length <= 4) {
    for (const rowIndex of leftoverRows) {
      const best = scores[rowIndex].find((candidate) => leftoverNames.includes(candidate.index));
      if (!best) continue;
      assignedRows.add(rowIndex);
      assignedNames.add(best.index);
      replacements.set(rowIndex, best.name);
    }
  }

  let snapped = 0;
  const nextRows = rows.map((row, rowIndex) => {
    const replacement = replacements.get(rowIndex);
    if (!replacement || replacement === row.character_name) return row;
    snapped += 1;
    return {
      ...row,
      character_name: replacement,
    };
  });

  return { rows: nextRows, snapped };
}

function repairShiftedStalcraftRows(rows: CwResultRow[]) {
  if (rows.length < 4) return { rows, repaired: false };

  const suspiciousRows = rows.filter((row) =>
    row.score === 0
    && row.treasury_spent > 0
    && row.assists >= 50
    && Boolean(extractTrailingStandaloneStat(row.character_name)),
  );

  if (suspiciousRows.length < Math.max(3, Math.ceil(rows.length * 0.45))) {
    return { rows, repaired: false };
  }

  return {
    repaired: true,
    rows: rows.map((row) => {
      const trailing = extractTrailingStandaloneStat(row.character_name);
      if (!trailing || row.score !== 0 || row.treasury_spent <= 0) return row;

      return {
        ...row,
        character_name: trailing.character_name || row.character_name,
        kills: trailing.value,
        deaths: Math.max(0, toInt(row.kills)),
        assists: Math.max(0, toInt(row.deaths)),
        treasury_spent: Math.max(0, toInt(row.assists)),
        score: Math.max(0, toInt(row.treasury_spent)),
      };
    }),
  };
}

function repairTreasuryScoreTail(rows: CwResultRow[]) {
  if (rows.length < 4) return { rows, repaired: false };

  const suspiciousRows = rows.filter((row) => row.treasury_spent >= 50_000 && row.score >= 0 && row.score < 100);
  if (suspiciousRows.length < Math.max(3, Math.ceil(rows.length * 0.45))) {
    return { rows, repaired: false };
  }

  const repairedRows = rows.map((row) => {
    if (row.treasury_spent < 10_000 || row.score >= 100) return row;

    const digits = String(Math.max(0, toInt(row.treasury_spent)));
    let bestTreasury = row.treasury_spent;
    let bestScore = row.score;
    let bestPenalty = Number.POSITIVE_INFINITY;

    for (const movedDigits of [2, 1, 3] as const) {
      if (digits.length <= movedDigits + 1) continue;
      const treasuryDigits = digits.slice(0, -movedDigits);
      const scorePrefix = digits.slice(-movedDigits);
      const scoreSuffix = String(Math.max(0, toInt(row.score))).padStart(2, "0");
      const nextTreasury = Math.max(0, toInt(treasuryDigits));
      const nextScore = Math.max(0, toInt(`${scorePrefix}${scoreSuffix}`));

      if (nextTreasury <= 0 || nextScore <= 0) continue;

      let penalty = 0;
      if (nextTreasury > 99_999) penalty += 60;
      if (nextScore > 9_999) penalty += 50;
      if (nextScore < 100) penalty += 80;
      if (nextTreasury < Math.max(row.kills, row.deaths)) penalty += 40;

      const ratio = nextScore > 0 ? nextTreasury / nextScore : 99;
      if (ratio > 25) penalty += 30;
      if (ratio < 0.08) penalty += 30;

      if (movedDigits !== 2) penalty += 6;

      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestTreasury = nextTreasury;
        bestScore = nextScore;
      }
    }

    if (bestPenalty === Number.POSITIVE_INFINITY) return row;
    return {
      ...row,
      treasury_spent: bestTreasury,
      score: bestScore,
    };
  });

  return { rows: repairedRows, repaired: true };
}

function scoreNumericPlausibility(row: CwResultRow) {
  let score = 0;
  if (row.kills >= 0 && row.kills <= 15) score += 8; else score -= 8;
  if (row.deaths >= 0 && row.deaths <= 15) score += 8; else score -= 8;
  if (row.assists >= 0 && row.assists <= 15) score += 8; else score -= 8;

  if (row.treasury_spent >= 100 && row.treasury_spent <= 50_000) score += 20;
  else if (row.treasury_spent > 0 && row.treasury_spent <= 120_000) score += 6;
  else score -= 12;

  if (row.score >= 100 && row.score <= 9_999) score += 22;
  else if (row.score > 0 && row.score <= 20_000) score += 10;
  else if (row.score === 0 && row.treasury_spent > 0) score -= 20;
  else score -= 10;

  if (row.treasury_spent > 0 && row.score > 0) {
    const ratio = row.treasury_spent / row.score;
    if (ratio >= 0.08 && ratio <= 8) score += 8;
    else score -= 10;
  }

  if (row.score > 5000 && row.treasury_spent < 2500) score -= 12;
  if (row.treasury_spent > 50000 && row.score < 2500) score -= 12;
  return score;
}

function generateNumberCandidates(value: number, kind: "treasury" | "score") {
  const digits = String(Math.max(0, toInt(value)));
  const candidates = new Map<number, number>([[Math.max(0, toInt(value)), 0]]);

  if ((kind === "treasury" && value > 50_000) || (kind === "score" && value > 5_000)) {
    for (let index = 0; index < digits.length; index += 1) {
      const next = `${digits.slice(0, index)}${digits.slice(index + 1)}`;
      if (!next) continue;
      const numeric = Math.max(0, toInt(next));
      candidates.set(numeric, Math.min(candidates.get(numeric) ?? Number.POSITIVE_INFINITY, 1));
    }
  }

  if (digits.length >= 4) {
    for (let index = 0; index < digits.length - 1; index += 1) {
      const chars = digits.split("");
      [chars[index], chars[index + 1]] = [chars[index + 1], chars[index]];
      const numeric = Math.max(0, toInt(chars.join("")));
      candidates.set(numeric, Math.min(candidates.get(numeric) ?? Number.POSITIVE_INFINITY, 1));
    }
  }

  return [...candidates.entries()]
    .map(([candidate, edits]) => ({ value: candidate, edits }))
    .filter((candidate) => candidate.value >= 0);
}

function repairDigitNoise(rows: CwResultRow[]) {
  let repaired = false;
  const nextRows = rows.map((row) => {
    const treasuryCandidates = generateNumberCandidates(row.treasury_spent, "treasury");
    const scoreCandidates = generateNumberCandidates(row.score, "score");

    let bestRow = row;
    let bestScore = scoreNumericPlausibility(row);

    for (const treasury of treasuryCandidates) {
      for (const score of scoreCandidates) {
        const candidate = { ...row, treasury_spent: treasury.value, score: score.value };
        const candidateScore = scoreNumericPlausibility(candidate) - (treasury.edits + score.edits) * 6;
        if (candidateScore > bestScore + 6) {
          bestRow = candidate;
          bestScore = candidateScore;
        }
      }
    }

    if (bestRow.treasury_spent !== row.treasury_spent || bestRow.score !== row.score) {
      repaired = true;
    }
    return bestRow;
  });

  return { rows: nextRows, repaired };
}

function repairHugeScoreForLowTreasury(rows: CwResultRow[]) {
  let repaired = false;
  const nextRows = rows.map((row) => {
    if (!(row.treasury_spent > 0 && row.treasury_spent < 5_000 && row.score > 4_500)) {
      return row;
    }

    const scoreCandidates = generateNumberCandidates(row.score, "score")
      .filter((candidate) => candidate.value > 0 && candidate.value < row.score);

    let bestRow = row;
    let bestScore = scoreNumericPlausibility(row);

    for (const candidate of scoreCandidates) {
      const next = { ...row, score: candidate.value };
      const nextScore = scoreNumericPlausibility(next) - candidate.edits * 4;
      if (nextScore > bestScore + 4) {
        bestRow = next;
        bestScore = nextScore;
      }
    }

    if (bestRow.score !== row.score) repaired = true;
    return bestRow;
  });

  return { rows: nextRows, repaired };
}

export function sanitizeCwRows(rows: CwResultRow[], knownNames: string[] = []) {
  const unique = new Map<string, CwResultRow>();
  let discarded = 0;
  let deduped = 0;

  for (const row of rows) {
    const character_name = cleanPlayerName(row.character_name);
    if (!looksLikeRealPlayerName(character_name)) {
      discarded += 1;
      continue;
    }

    const normalized: CwResultRow = {
      character_name,
      matches_count: Math.max(1, toInt(row.matches_count || 1)),
      kills: Math.max(0, toInt(row.kills)),
      deaths: Math.max(0, toInt(row.deaths)),
      assists: Math.max(0, toInt(row.assists)),
      treasury_spent: Math.max(0, toInt(row.treasury_spent)),
      score: Math.max(0, toInt(row.score)),
    };

    if (
      normalized.kills > 3000
      || normalized.deaths > 3000
      || normalized.assists > 3000
      || normalized.treasury_spent > 2_000_000_000
      || normalized.score > 2_000_000_000
    ) {
      discarded += 1;
      continue;
    }

    const key = normalizedPlayerKey(character_name);
    const current = unique.get(key);
    if (current) deduped += 1;
    if (!current || rowSignalScore(normalized) > rowSignalScore(current)) {
      unique.set(key, normalized);
    }
  }

  const rosterAssigned = assignRowsToRoster([...unique.values()], knownNames);
  const repairedRows = repairShiftedStalcraftRows(rosterAssigned.rows);
  const repairedTreasuryRows = repairTreasuryScoreTail(repairedRows.rows);
  const repairedDigitNoiseRows = repairDigitNoise(repairedTreasuryRows.rows);
  const repairedHugeScoreRows = repairHugeScoreForLowTreasury(repairedDigitNoiseRows.rows);
  const cleanRows = repairedHugeScoreRows.rows.sort((a, b) => b.score - a.score || b.kills - a.kills || a.character_name.localeCompare(b.character_name, "ru"));

  const notes: string[] = [];
  if (discarded > 0) notes.push(`Скрыто подозрительных или мусорных строк: ${discarded}.`);
  if (deduped > 0) notes.push("Повторяющиеся ники автоматически схлопнуты в лучший вариант строки.");
  if (rosterAssigned.snapped > 0) notes.push(`Ники привязаны к составу клана: ${rosterAssigned.snapped}.`);
  if (repairedRows.repaired) notes.push("Обнаружен сдвиг колонок в STALCRAFT-таблице: убийства вынесены из имени, а счёт восстановлен из соседней колонки.");
  if (repairedTreasuryRows.repaired) notes.push("Обнаружен склеенный хвост счёта в колонке казны: казна уменьшена, а счёт восстановлен из последних цифр.");
  if (repairedDigitNoiseRows.repaired) notes.push("Обнаружены лишние цифры в казне или счёте: применена локальная нормализация чисел.");
  if (repairedHugeScoreRows.repaired) notes.push("Обнаружен завышенный счёт при маленькой казне: счёт скорректирован по более правдоподобному кандидату.");

  return { rows: cleanRows, notes };
}
