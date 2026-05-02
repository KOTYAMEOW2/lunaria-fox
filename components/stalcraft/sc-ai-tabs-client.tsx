"use client";

import { useState } from "react";

export function ScAiTabsClient({ guildId, knownNames }: { guildId: string; knownNames: string[] }) {
  const [status, setStatus] = useState("Загрузи скрин таблицы КВ. ИИ вернёт JSON строк для проверки.");
  const [jsonText, setJsonText] = useState("[]");
  const [busy, setBusy] = useState(false);

  async function fileToDataUrl(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Не удалось прочитать изображение."));
      reader.readAsDataURL(file);
    });
  }

  async function extract(file: File) {
    setBusy(true);
    setStatus("ИИ читает таблицу...");
    try {
      const imageDataUrl = await fileToDataUrl(file);
      const response = await fetch(`/api/sc/guilds/${guildId}/cw-results/ai-extract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl, knownNames }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "AI extraction failed.");
      setJsonText(JSON.stringify(body.rows || [], null, 2));
      setStatus(`ИИ нашёл строк: ${(body.rows || []).length}. Проверь JSON и сохрани.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ошибка AI-разбора.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setStatus("Сохраняю строки...");
    try {
      const rawRows = JSON.parse(jsonText);
      const rows = (Array.isArray(rawRows) ? rawRows : []).map((row) => ({
        character_name: String(row.character_name || "").trim(),
        matches_count: Math.max(1, Number.parseInt(String(row.matches_count || 1), 10) || 1),
        kills: Math.max(0, Number.parseInt(String(row.kills || 0), 10) || 0),
        deaths: Math.max(0, Number.parseInt(String(row.deaths || 0), 10) || 0),
        assists: Math.max(0, Number.parseInt(String(row.assists || 0), 10) || 0),
        treasury_spent: Math.max(0, Number.parseInt(String(row.treasury_spent || 0), 10) || 0),
        score: Number.parseInt(String(row.score || 0), 10) || 0,
      })).filter((row) => row.character_name);
      if (!rows.length) throw new Error("Нет строк для сохранения.");
      const response = await fetch(`/api/sc/guilds/${guildId}/cw-results`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Ошибка сохранения.");
      setStatus(`Сохранено строк: ${body.count || rows.length}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Ошибка сохранения.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sc-card sc-stack">
      <h2>ИИ-разбор табов КВ</h2>
      <p className="muted">MVP: скрин → AI JSON → ручная проверка → сохранение в очередь табов.</p>
      <input disabled={busy} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void extract(file);
        event.currentTarget.value = "";
      }} />
      <div className="sc-muted-panel">{status}</div>
      <textarea value={jsonText} onChange={(event) => setJsonText(event.target.value)} rows={18} style={{ width: "100%", fontFamily: "monospace" }} />
      <button className="btn-primary" type="button" disabled={busy} onClick={save}>Сохранить строки</button>
    </div>
  );
}
