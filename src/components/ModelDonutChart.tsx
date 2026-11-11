import React, { useState } from "react";
import { ModelLogo, detectProvider } from "./ModelLogo";

export interface ModelStatItem {
  model: string;
  requests: number;
  cost: number;
  actual_cost?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  total_tokens?: number;
}

interface ModelDonutChartProps {
  stats: ModelStatItem[];
}

export const ModelDonutChart: React.FC<ModelDonutChartProps> = ({ stats }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const getSpend = (item: ModelStatItem) =>
    item.actual_cost !== undefined ? item.actual_cost : item.cost || 0;

  const nonZeroStats = stats.filter((s) => getSpend(s) > 0.0001);
  const totalSpend = nonZeroStats.reduce((acc, curr) => acc + getSpend(curr), 0);

  if (nonZeroStats.length === 0 || totalSpend <= 0) {
    return (
      <div className="bento-card apple-donut-empty">
        <span>Нет данных о распределении расходов по моделям</span>
      </div>
    );
  }

  const FALLBACK_COLORS = [
    "#0a84ff",
    "#8b5cf6",
    "#10a37f",
    "#ff9f0a",
    "#bf5af2",
    "#64d2ff",
    "#ff375f",
    "#ffd60a",
  ];

  const radius = 64;
  const strokeWidth = 17;
  const circumference = 2 * Math.PI * radius;
  let cumulativeAngle = -90;

  const slices = nonZeroStats.map((item, idx) => {
    const spend = getSpend(item);
    const fraction = spend / totalSpend;
    const strokeDasharray = `${Math.max(2, fraction * circumference)} ${circumference}`;
    const rotation = cumulativeAngle;
    cumulativeAngle += fraction * 360;
    const provider = detectProvider(item.model);
    // Distinct color per slice: use provider color for first of family, fallback palette if duplicate
    const color =
      idx === 0
        ? provider.color
        : idx < FALLBACK_COLORS.length
        ? FALLBACK_COLORS[idx]
        : provider.color;

    return {
      ...item,
      spend,
      provider,
      fraction,
      percent: (fraction * 100).toFixed(1),
      strokeDasharray,
      rotation,
      color,
    };
  });

  const activeItem = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div className="bento-card apple-donut-container">
      <div className="apple-donut-visual">
        <svg viewBox="0 0 160 160" className="apple-donut-svg">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={strokeWidth}
          />
          {slices.map((slice, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <circle
                key={slice.model + idx}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeLinecap="round"
                transform={`rotate(${slice.rotation} 80 80)`}
                className="apple-donut-slice"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  opacity: hoveredIdx !== null && !isHovered ? 0.35 : 1,
                  filter: isHovered ? `drop-shadow(0 0 8px ${slice.color}88)` : "none",
                  transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
                  cursor: "pointer",
                }}
              />
            );
          })}
        </svg>

        <div className="apple-donut-center">
          {activeItem ? (
            <div className="donut-center-info">
              <ModelLogo model={activeItem.model} size={14} withBadge={false} />
              <span className="donut-center-pct" style={{ color: activeItem.color }}>
                {activeItem.percent}%
              </span>
              <span className="donut-center-cost">${activeItem.spend.toFixed(2)}</span>
            </div>
          ) : (
            <div className="donut-center-info">
              <span className="donut-center-total-label">РАСХОД</span>
              <span className="donut-center-total">${totalSpend.toFixed(2)}</span>
              <span className="donut-center-sub">{slices.length} мод.</span>
            </div>
          )}
        </div>
      </div>

      <div className="apple-donut-legend">
        {slices.slice(0, 6).map((slice, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={slice.model}
              className={`donut-legend-item ${isHovered ? "active" : ""}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <ModelLogo model={slice.model} size={13} withBadge={true} />
              <div className="legend-details">
                <div className="legend-title-row">
                  <span className="legend-name" title={slice.model}>
                    {slice.model.replace(/^openai\/|^anthropic\/|^google\//, "")}
                  </span>
                  <span className="legend-dot-color" style={{ backgroundColor: slice.color }} />
                </div>
                <span className="legend-meta">
                  {slice.percent}% • ${slice.spend.toFixed(2)} • {slice.requests.toLocaleString()} зап.
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
