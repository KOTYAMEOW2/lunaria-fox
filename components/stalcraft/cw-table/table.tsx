"use client";

import { useMemo, useState } from "react";

type SortKey = "name" | "matches" | "kills" | "deaths" | "assists" | "treasury" | "score" | "kd" | "kda";

type SortState = { key: SortKey; dir: "asc" | "desc" };

export type TableRow = {
  character_name: string;
  matches_count: number;
  tabs_count?: number;
  kills: number;
  deaths: number;
  assists: number;
  treasury_spent: number;
  score: number;
};

const PAGE_SIZE = 20;

export function calcKd(row: TableRow): number {
  if (row.deaths === 0) return row.kills > 0 ? 99 : 0;
  return row.kills / row.deaths;
}

export function calcKda(row: TableRow): number {
  if (row.deaths === 0) return row.kills + row.assists > 0 ? 99 : 0;
  return (row.kills + row.assists) / row.deaths;
}

export function kdClass(value: number): string {
  if (value >= 1.5) return "kd-good";
  if (value < 0.8) return "kd-bad";
  return "kd-neutral";
}

export function kdaClass(value: number): string {
  if (value >= 3.0) return "kda-good";
  if (value < 1.5) return "kda-bad";
  return "kda-neutral";
}

function sortIndicator(key: SortKey, state: SortState): string {
  if (state.key !== key) return "▼";
  return state.dir === "asc" ? "▲" : "▼";
}

function applySort(rows: TableRow[], state: SortState): TableRow[] {
  return [...rows].sort((a, b) => {
    let av: number | string = 0;
    let bv: number | string = 0;

    switch (state.key) {
      case "name":      av = a.character_name.toLowerCase(); bv = b.character_name.toLowerCase(); break;
      case "matches":   av = a.matches_count; bv = b.matches_count; break;
      case "kills":     av = a.kills; bv = b.kills; break;
      case "deaths":    av = a.deaths; bv = b.deaths; break;
      case "assists":   av = a.assists; bv = b.assists; break;
      case "treasury":  av = a.treasury_spent; bv = b.treasury_spent; break;
      case "score":     av = a.score; bv = b.score; break;
      case "kd":        av = calcKd(a); bv = calcKd(b); break;
      case "kda":       av = calcKda(a); bv = calcKda(b); break;
    }

    if (av < bv) return state.dir === "asc" ? -1 : 1;
    if (av > bv) return state.dir === "asc" ? 1 : -1;
    return 0;
  });
}

function toCsv(rows: TableRow[]): string {
  const header = "Игрок,Матчей,Убийства,Смерти,Помощь,Казна,Счёт,K/D,KDA";
  const body = rows.map(r =>
    `${r.character_name},${r.matches_count},${r.kills},${r.deaths},${r.assists},${r.treasury_spent},${r.score},${calcKd(r).toFixed(2)},${calcKda(r).toFixed(2)}`
  );
  return [header, ...body].join("\n");
}

export type CwTableImprovedProps = {
  rows: TableRow[];
  emptyMessage?: string;
  showPublishHint?: string;
};

export function CwTableImproved({ rows, emptyMessage = "Табы пока не загружены.", showPublishHint }: CwTableImprovedProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "score", dir: "desc" });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.character_name.toLowerCase().includes(q));
  }, [rows, search]);

  const sorted = useMemo(() => applySort(filtered, sort), [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key, dir: "desc" }
    );
    setPage(1);
  };

  const th = (label: string, key: SortKey, extra?: string) => {
    const isActive = sort.key === key;
    return (
      <th
        key={key}
        className={`sortable${isActive ? ` sort-${sort.dir}` : ""}${extra ? ` ${extra}` : ""}`}
        onClick={() => handleSort(key)}
      >
        {label}
        <span className="sort-indicator">{sortIndicator(key, sort)}</span>
      </th>
    );
  };

  const handleExport = () => {
    const csv = toCsv(sorted);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cw-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    const csv = toCsv(sorted);
    void navigator.clipboard.writeText(csv);
  };

  const topKills = Math.max(...rows.map(r => r.kills), 0);
  const topScore = Math.max(...rows.map(r => r.score), 0);
  const topKdVal = Math.max(...rows.map(r => calcKd(r)), 0);
  const topKdaVal = Math.max(...rows.map(r => calcKda(r)), 0);

  const fmt = (n: number) => new Intl.NumberFormat("ru-RU").format(n);

  if (rows.length === 0) {
    return (
      <div className="cw-empty-state">
        <strong>Нет данных</strong>
        <p>{emptyMessage}</p>
        {showPublishHint ? <p style={{ marginTop: 8, color: "var(--text-soft)" }}>{showPublishHint}</p> : null}
      </div>
    );
  }

  return (
    <div>
      {showPublishHint ? (
        <div className="panel-note" style={{ marginBottom: 14 }}>
          {showPublishHint}
        </div>
      ) : null}

      <div className="cw-table-toolbar">
        <input
          className="cw-table-search"
          placeholder="Поиск по нику..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <button className="cw-export-btn" onClick={handleCopy} title="Копировать как CSV">
          Копировать CSV
        </button>
        <button className="cw-export-btn" onClick={handleExport} title="Скачать CSV">
          Скачать CSV
        </button>
      </div>

      <div className="cw-table-wrap">
        <table className="cw-result-table">
          <thead>
            <tr>
              <th>#</th>
              {th("Игрок", "name")}
              {th("Матчей", "matches")}
              {th("Убийства", "kills")}
              {th("Смерти", "deaths")}
              {th("Помощь", "assists")}
              {th("Казна", "treasury")}
              {th("Счёт", "score")}
              {th("K/D", "kd")}
              {th("KDA", "kda")}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => {
              const idx = (currentPage - 1) * PAGE_SIZE + i + 1;
              const kdVal = calcKd(row);
              const kdaVal = calcKda(row);
              const multiMatch = (row.matches_count > 1 || (row.tabs_count || 0) > 1);

              const isTopKiller = row.kills === topKills && topKills > 0;
              const isTopScore = row.score === topScore && topScore > 0;
              const isTopKd = kdVal === topKdVal && topKdVal > 0;
              const isTopKda = kdaVal === topKdaVal && topKdaVal > 0;

              const cell = (val: number | string, cls: string, isTop: boolean) => (
                <td className={isTop ? "top-cell-value" : ""}>
                  <span className={cls}>{val}</span>
                </td>
              );

              return (
                <tr
                  key={row.character_name + i}
                  className={[
                    isTopKiller ? "top-killer" : "",
                    isTopScore ? "top-score" : "",
                    isTopKd ? "top-kd" : "",
                    isTopKda ? "top-kda" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <td>
                    {idx}
                    {multiMatch && (
                      <span className="multi-badge" style={{ marginLeft: 5, verticalAlign: "middle" }}>
                        {row.tabs_count ? `${row.tabs_count} таб.` : `${row.matches_count} мат.`}
                      </span>
                    )}
                  </td>
                  <td><strong>{row.character_name}</strong></td>
                  <td>{fmt(row.matches_count)}</td>
                  <td className={isTopKiller ? "top-cell-value" : ""}>{fmt(row.kills)}</td>
                  <td>{fmt(row.deaths)}</td>
                  <td>{fmt(row.assists)}</td>
                  <td>{fmt(row.treasury_spent)}</td>
                  <td className={isTopScore ? "top-cell-value" : ""}>{fmt(row.score)}</td>
                  {cell(kdVal === 99 ? "∞" : kdVal.toFixed(2), kdClass(kdVal), isTopKd)}
                  {cell(kdaVal === 99 ? "∞" : kdaVal.toFixed(2), kdaClass(kdaVal), isTopKda)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="cw-pagination">
          <button
            className="cw-page-btn"
            disabled={currentPage <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            ← Назад
          </button>
          <span className="cw-page-info">
            {currentPage} / {totalPages}
          </span>
          <button
            className="cw-page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Вперёд →
          </button>
        </div>
      )}

      <p style={{ marginTop: 8, fontSize: "0.78rem", color: "var(--text-soft)" }}>
        Показано {sorted.length} из {rows.length} игроков
        {sorted.length !== rows.length ? ` (фильтр: &ldquo;${search}&rdquo;)` : ""}
      </p>
    </div>
  );
}
