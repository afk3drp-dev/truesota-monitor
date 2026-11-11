import React, { useMemo, useState } from "react";
import { Flame, Calendar, Sparkles, Database, TrendingDown } from "lucide-react";
import { ModelLogo } from "./ModelLogo";

export interface HeatmapDailyItem {
  date: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  total_tokens: number;
  cost: number;
  actual_cost: number;
}

export interface CacheModelStatItem {
  model: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
  total_tokens: number;
  cost: number;
  actual_cost: number;
  account_cost?: number;
}

interface ActivityHeatmapProps {
  dailyUsage: HeatmapDailyItem[];
  modelStats: CacheModelStatItem[];
}

type HeatmapMetric = "cost" | "tokens" | "requests";

function fmtCompactTokens(n: number): string {
  if (!n || n <= 0) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function toLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateSafe(dateStr: string): string {
  // Accept YYYY-MM-DD or ISO datetime
  const m = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : dateStr;
}

const MONTH_SHORT_RU = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
];

function fmtDateRu(ymd: string): string {
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  const mIdx = Math.max(0, Math.min(11, parseInt(parts[1], 10) - 1));
  return `${parseInt(parts[2], 10)} ${MONTH_SHORT_RU[mIdx]} ${parts[0]}`;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  dailyUsage,
  modelStats,
}) => {
  const [metric, setMetric] = useState<HeatmapMetric>("cost");
  const [hoveredYmd, setHoveredYmd] = useState<string | null>(null);

  const dayMap = useMemo(() => {
    const map = new Map<string, HeatmapDailyItem>();
    for (const item of dailyUsage) {
      const key = parseDateSafe(item.date);
      const existing = map.get(key);
      if (existing) {
        map.set(key, {
          ...existing,
          requests: existing.requests + (item.requests || 0),
          input_tokens: existing.input_tokens + (item.input_tokens || 0),
          output_tokens: existing.output_tokens + (item.output_tokens || 0),
          cache_read_tokens:
            (existing.cache_read_tokens || 0) + (item.cache_read_tokens || 0),
          cache_write_tokens:
            (existing.cache_write_tokens || 0) + (item.cache_write_tokens || 0),
          total_tokens: existing.total_tokens + (item.total_tokens || 0),
          cost: existing.cost + (item.cost || 0),
          actual_cost: existing.actual_cost + (item.actual_cost || 0),
        });
      } else {
        map.set(key, { ...item, date: key });
      }
    }
    return map;
  }, [dailyUsage]);

  // Build 22 weeks (154 days) ending on the Saturday of current week
  const { weeks, monthLabels, stats, maxMetricVal, defaultSelectedYmd } =
    useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Monday = 0 ... Sunday = 6
      const jsDay = today.getDay();
      const monOffset = jsDay === 0 ? 6 : jsDay - 1;
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (6 - monOffset));

      const totalWeeks = 22;
      const startDate = new Date(endOfWeek);
      startDate.setDate(endOfWeek.getDate() - (totalWeeks * 7 - 1));

      const weeksArr: {
        ymd: string;
        inFuture: boolean;
        data?: HeatmapDailyItem;
      }[][] = [];
      const mLabels: { col: number; label: string }[] = [];
      let lastMonth = -1;

      const cursor = new Date(startDate);
      let maxVal = 0;
      let activeDays = 0;
      let peakDay: HeatmapDailyItem | null = null;
      let latestActive: string | null = null;

      for (let w = 0; w < totalWeeks; w++) {
        const col: { ymd: string; inFuture: boolean; data?: HeatmapDailyItem }[] =
          [];
        for (let r = 0; r < 7; r++) {
          const ymd = toLocalYMD(cursor);
          const inFuture = cursor.getTime() > today.getTime();
          const item = dayMap.get(ymd);

          if (r === 0) {
            const m = cursor.getMonth();
            if (m !== lastMonth) {
              mLabels.push({ col: w, label: MONTH_SHORT_RU[m] });
              lastMonth = m;
            }
          }

          if (item && (item.requests > 0 || item.total_tokens > 0)) {
            activeDays += 1;
            latestActive = ymd;
            const v =
              metric === "cost"
                ? item.actual_cost || item.cost
                : metric === "tokens"
                  ? item.total_tokens
                  : item.requests;
            if (v > maxVal) maxVal = v;
            if (
              !peakDay ||
              (item.actual_cost || item.cost) >
                (peakDay.actual_cost || peakDay.cost)
            ) {
              peakDay = item;
            }
          }

          col.push({ ymd, inFuture, data: item });
          cursor.setDate(cursor.getDate() + 1);
        }
        weeksArr.push(col);
      }

      // Compute current streak up to today / yesterday
      let streak = 0;
      const checkDate = new Date(today);
      const todayData = dayMap.get(toLocalYMD(checkDate));
      if (!todayData || (todayData.requests === 0 && todayData.total_tokens === 0)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
      for (let i = 0; i < 365; i++) {
        const key = toLocalYMD(checkDate);
        const d = dayMap.get(key);
        if (d && (d.requests > 0 || d.total_tokens > 0)) {
          streak += 1;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      // Longest streak within range
      let longestStreak = 0;
      let running = 0;
      for (const week of weeksArr) {
        for (const cell of week) {
          if (cell.inFuture) continue;
          if (cell.data && (cell.data.requests > 0 || cell.data.total_tokens > 0)) {
            running += 1;
            if (running > longestStreak) longestStreak = running;
          } else {
            running = 0;
          }
        }
      }

      return {
        weeks: weeksArr,
        monthLabels: mLabels,
        stats: { activeDays, streak, longestStreak, peakDay },
        maxMetricVal: maxVal,
        defaultSelectedYmd: latestActive || toLocalYMD(today),
      };
    }, [dayMap, metric]);

  const getCellLevel = (item?: HeatmapDailyItem): number => {
    if (!item) return 0;
    const val =
      metric === "cost"
        ? item.actual_cost || item.cost
        : metric === "tokens"
          ? item.total_tokens
          : item.requests;
    if (val <= 0 || maxMetricVal <= 0) return 0;
    const ratio = val / maxMetricVal;
    if (ratio >= 0.72) return 4;
    if (ratio >= 0.45) return 3;
    if (ratio >= 0.18) return 2;
    return 1;
  };

  const inspectedYmd = hoveredYmd || defaultSelectedYmd;
  const inspectedData = dayMap.get(inspectedYmd);

  // Cache Efficiency Profiler computation
  const cacheProfiler = useMemo(() => {
    let totalTokensAll = 0;
    let totalCacheReadAll = 0;
    let totalCostNominal = 0;
    let totalCostActual = 0;

    const rows = modelStats
      .map((m) => {
        const cacheRead = m.cache_read_tokens || 0;
        const input = m.input_tokens || 0;
        const output = m.output_tokens || 0;
        const total = m.total_tokens || input + output + cacheRead;
        const cacheHitPct = total > 0 ? (cacheRead / total) * 100 : 0;
        const savedUsd = Math.max(0, (m.cost || 0) - (m.actual_cost || 0));

        totalTokensAll += total;
        totalCacheReadAll += cacheRead;
        totalCostNominal += m.cost || 0;
        totalCostActual += m.actual_cost || 0;

        const denom = Math.max(1, input + cacheRead + output);
        return {
          ...m,
          cacheRead,
          total,
          cacheHitPct,
          savedUsd,
          pctInput: (input / denom) * 100,
          pctCache: (cacheRead / denom) * 100,
          pctOutput: (output / denom) * 100,
        };
      })
      .sort((a, b) => {
        if (b.cacheRead !== a.cacheRead) return b.cacheRead - a.cacheRead;
        return b.total - a.total;
      });

    const overallCachePct =
      totalTokensAll > 0 ? (totalCacheReadAll / totalTokensAll) * 100 : 0;
    const totalSaved = Math.max(0, totalCostNominal - totalCostActual);
    const bestModel = rows.find((r) => r.cacheRead > 0);
    const uncachedHeavy = rows.find(
      (r) => r.cacheHitPct < 5 && (r.input_tokens || 0) > 10_000,
    );

    return {
      rows,
      totalTokensAll,
      totalCacheReadAll,
      overallCachePct,
      totalSaved,
      bestModel,
      uncachedHeavy,
    };
  }, [modelStats]);

  return (
    <div className="analytics-container">
      {/* 1. Activity Heatmap Bento Card */}
      <div className="bento-card heatmap-card">
        <div className="heatmap-header">
          <div className="heatmap-title-group">
            <div className="heatmap-title-row">
              <Calendar size={15} className="hm-icon-blue" />
              <span className="card-title" style={{ marginBottom: 0 }}>
                Тепловая карта активности
              </span>
              <span className="hm-period-badge">22 недели</span>
            </div>
            <span className="hm-subtitle">
              Распределение ежедневной нагрузки по TrueSOTA API
            </span>
          </div>

          <div className="hm-metric-switcher">
            <button
              type="button"
              className={`hm-metric-btn ${metric === "cost" ? "active" : ""}`}
              onClick={() => setMetric("cost")}
            >
              Расход $
            </button>
            <button
              type="button"
              className={`hm-metric-btn ${metric === "tokens" ? "active" : ""}`}
              onClick={() => setMetric("tokens")}
            >
              Токены
            </button>
            <button
              type="button"
              className={`hm-metric-btn ${metric === "requests" ? "active" : ""}`}
              onClick={() => setMetric("requests")}
            >
              Запросы
            </button>
          </div>
        </div>

        {/* Streak KPI Strip */}
        <div className="hm-kpi-strip">
          <div className="hm-kpi-pill">
            <Flame size={13} style={{ color: "var(--apple-orange)" }} />
            <span className="hm-kpi-label">Серия сейчас</span>
            <span className="hm-kpi-value">{stats.streak} дн.</span>
          </div>
          <div className="hm-kpi-pill">
            <Sparkles size={13} style={{ color: "var(--apple-cyan)" }} />
            <span className="hm-kpi-label">Рекорд серии</span>
            <span className="hm-kpi-value">{stats.longestStreak} дн.</span>
          </div>
          <div className="hm-kpi-pill">
            <Calendar size={13} style={{ color: "var(--apple-green)" }} />
            <span className="hm-kpi-label">Активных дней</span>
            <span className="hm-kpi-value">{stats.activeDays}</span>
          </div>
          <div className="hm-kpi-pill">
            <Database size={13} style={{ color: "var(--apple-purple)" }} />
            <span className="hm-kpi-label">Пик</span>
            <span className="hm-kpi-value">
              {stats.peakDay
                ? `$${(stats.peakDay.actual_cost || stats.peakDay.cost).toFixed(2)}`
                : "$0.00"}
            </span>
          </div>
        </div>

        {/* Grid */}
        <div className="hm-grid-scroll">
          <div className="hm-months-row">
            <span className="hm-day-gutter" />
            <div className="hm-months-track">
              {weeks.map((_, colIdx) => {
                const m = monthLabels.find((lbl) => lbl.col === colIdx);
                return (
                  <span key={colIdx} className="hm-month-cell">
                    {m ? m.label : ""}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="hm-body-row">
            <div className="hm-day-labels">
              <span>Пн</span>
              <span></span>
              <span>Ср</span>
              <span></span>
              <span>Пт</span>
              <span></span>
              <span>Вс</span>
            </div>

            <div className="hm-weeks-grid">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="hm-week-col">
                  {week.map((cell) => {
                    const lvl = cell.inFuture ? -1 : getCellLevel(cell.data);
                    const isSelected = cell.ymd === inspectedYmd;
                    return (
                      <button
                        key={cell.ymd}
                        type="button"
                        disabled={cell.inFuture}
                        onMouseEnter={() => setHoveredYmd(cell.ymd)}
                        onFocus={() => setHoveredYmd(cell.ymd)}
                        onClick={() => setHoveredYmd(cell.ymd)}
                        className={`hm-cell ${
                          lvl < 0 ? "hm-lvl-future" : `hm-lvl-${lvl}`
                        } ${isSelected ? "selected" : ""}`}
                        aria-label={`${cell.ymd}: ${cell.data?.requests ?? 0} req`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Inspected Day Footer + Legend */}
        <div className="hm-footer">
          <div className="hm-inspected-info">
            <span className="hm-inspected-date">{fmtDateRu(inspectedYmd)}</span>
            {inspectedData &&
            (inspectedData.requests > 0 || inspectedData.total_tokens > 0) ? (
              <div className="hm-inspected-metrics">
                <span>
                  <b>{inspectedData.requests}</b> запр.
                </span>
                <span>•</span>
                <span>
                  <b>{fmtCompactTokens(inspectedData.total_tokens)}</b> ток.
                </span>
                <span>•</span>
                <span style={{ color: "var(--apple-green)" }}>
                  $
                  {(
                    inspectedData.actual_cost || inspectedData.cost
                  ).toFixed(3)}
                </span>
                {(inspectedData.cache_read_tokens || 0) > 0 && (
                  <>
                    <span>•</span>
                    <span style={{ color: "var(--apple-cyan)" }}>
                      кэш {fmtCompactTokens(inspectedData.cache_read_tokens || 0)}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <span className="hm-inspected-empty">Нет активности в этот день</span>
            )}
          </div>

          <div className="hm-legend">
            <span>Меньше</span>
            <span className="hm-legend-box hm-lvl-0" />
            <span className="hm-legend-box hm-lvl-1" />
            <span className="hm-legend-box hm-lvl-2" />
            <span className="hm-legend-box hm-lvl-3" />
            <span className="hm-legend-box hm-lvl-4" />
            <span>Больше</span>
          </div>
        </div>
      </div>

      {/* 2. Cache Efficiency Profiler Card */}
      <div className="bento-card cache-profiler-card">
        <div className="cache-profiler-header">
          <div>
            <div className="heatmap-title-row">
              <TrendingDown size={15} style={{ color: "var(--apple-green)" }} />
              <span className="card-title" style={{ marginBottom: 0 }}>
                Профилирование кэша (Prompt Cache Audit)
              </span>
            </div>
            <span className="hm-subtitle">
              Разбивка input / cache-read / output токенов и реальная экономия
            </span>
          </div>

          <div className="cache-summary-pills">
            <div className="cache-stat-pill">
              <span className="cache-pill-label">Общий Cache Hit</span>
              <span
                className="cache-pill-val"
                style={{ color: "var(--apple-green)" }}
              >
                {cacheProfiler.overallCachePct.toFixed(1)}%
              </span>
            </div>
            <div className="cache-stat-pill">
              <span className="cache-pill-label">Из кэша</span>
              <span className="cache-pill-val" style={{ color: "var(--apple-cyan)" }}>
                {fmtCompactTokens(cacheProfiler.totalCacheReadAll)}
              </span>
            </div>
            <div className="cache-stat-pill">
              <span className="cache-pill-label">Сэкономлено</span>
              <span
                className="cache-pill-val"
                style={{ color: "var(--apple-green)" }}
              >
                ${cacheProfiler.totalSaved.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Stacked Legend */}
        <div className="cache-stack-legend">
          <span className="cache-leg-item">
            <i className="leg-dot leg-cache" /> Cache Read
          </span>
          <span className="cache-leg-item">
            <i className="leg-dot leg-input" /> Uncached Input
          </span>
          <span className="cache-leg-item">
            <i className="leg-dot leg-output" /> Output
          </span>
        </div>

        <div className="cache-models-list">
          {cacheProfiler.rows.length === 0 ? (
            <div className="empty-state" style={{ padding: "28px 0" }}>
              Нет данных по моделям за период
            </div>
          ) : (
            cacheProfiler.rows.slice(0, 10).map((row) => {
              const badgeTone =
                row.cacheHitPct >= 45
                  ? "good"
                  : row.cacheHitPct >= 15
                    ? "mid"
                    : "low";
              return (
                <div key={row.model} className="cache-model-row">
                  <div className="cache-row-top">
                    <div className="cache-row-identity">
                      <ModelLogo model={row.model} size={26} withBadge />
                      <div className="cache-row-names">
                        <span className="cache-row-model">{row.model}</span>
                        <span className="cache-row-sub">
                          {row.requests} запр. • всего {fmtCompactTokens(row.total)}{" "}
                          ток.
                        </span>
                      </div>
                    </div>

                    <div className="cache-row-right">
                      <span className={`cache-hit-badge ${badgeTone}`}>
                        {row.cacheHitPct.toFixed(1)}% кэш
                      </span>
                      <div className="cache-row-costs">
                        <span className="cache-cost-actual">
                          ${(row.actual_cost || 0).toFixed(3)}
                        </span>
                        {row.savedUsd > 0.0005 && (
                          <span className="cache-cost-saved">
                            −${row.savedUsd.toFixed(2)} экономия
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tri-segment ratio bar */}
                  <div className="cache-ratio-track">
                    {row.pctCache > 0 && (
                      <div
                        className="cache-bar-seg cache"
                        style={{ width: `${row.pctCache}%` }}
                        title={`Cache Read: ${fmtCompactTokens(row.cacheRead)} (${row.pctCache.toFixed(1)}%)`}
                      />
                    )}
                    {row.pctInput > 0 && (
                      <div
                        className="cache-bar-seg input"
                        style={{ width: `${row.pctInput}%` }}
                        title={`Input: ${fmtCompactTokens(row.input_tokens)} (${row.pctInput.toFixed(1)}%)`}
                      />
                    )}
                    {row.pctOutput > 0 && (
                      <div
                        className="cache-bar-seg output"
                        style={{ width: `${row.pctOutput}%` }}
                        title={`Output: ${fmtCompactTokens(row.output_tokens)} (${row.pctOutput.toFixed(1)}%)`}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {(cacheProfiler.bestModel || cacheProfiler.uncachedHeavy) && (
          <div className="cache-insight-banner">
            <Sparkles size={14} style={{ color: "var(--apple-blue)", flexShrink: 0 }} />
            <span>
              {cacheProfiler.bestModel && (
                <>
                  Лидер кэширования: <b>{cacheProfiler.bestModel.model}</b> (
                  {cacheProfiler.bestModel.cacheHitPct.toFixed(1)}% попаданий
                  {cacheProfiler.bestModel.savedUsd > 0.01
                    ? `, экономия $${cacheProfiler.bestModel.savedUsd.toFixed(2)}`
                    : ""}
                  ).{" "}
                </>
              )}
              {cacheProfiler.uncachedHeavy && (
                <>
                  Совет: <b>{cacheProfiler.uncachedHeavy.model}</b> имеет{" "}
                  {fmtCompactTokens(cacheProfiler.uncachedHeavy.input_tokens)}{" "}
                  входных токенов почти без кэша — проверь стабильность system
                  prompt префикса.
                </>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
