import React, { useEffect, useRef, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  X,
  Copy,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Sparkles,
} from "lucide-react";
import { detectProvider } from "./ModelLogo";
import type { HeatmapDailyItem, CacheModelStatItem } from "./ActivityHeatmap";
import { appleAudio } from "../utils/audio";

export interface ShareCardData {
  mode?: string;
  status?: string;
  remaining: number;
  limit: number;
  used: number;
  pctRemaining: number;
  totalTokens: number;
  totalRequests: number;
  cacheHitPct: number;
  savedUsd: number;
  avgDurationMs: number;
  modelStats: CacheModelStatItem[];
  dailyUsage: HeatmapDailyItem[];
}

interface ShareCardModalProps {
  open: boolean;
  onClose: () => void;
  data: ShareCardData;
}

function fmtCompact(n: number): string {
  if (!n || n <= 0) return "0";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  open,
  onClose,
  data,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copiedImg, setCopiedImg] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const renderCardCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1200;
    const H = 630;
    canvas.width = W;
    canvas.height = H;

    // 1. Deep OLED Canvas Background
    ctx.fillStyle = "#06080d";
    ctx.fillRect(0, 0, W, H);

    // Subtle ambient top glows
    const gBlue = ctx.createRadialGradient(260, -40, 20, 260, 80, 560);
    gBlue.addColorStop(0, "rgba(10, 132, 255, 0.28)");
    gBlue.addColorStop(1, "rgba(10, 132, 255, 0)");
    ctx.fillStyle = gBlue;
    ctx.fillRect(0, 0, W, H);

    const gPurple = ctx.createRadialGradient(980, 60, 10, 980, 120, 520);
    gPurple.addColorStop(0, "rgba(191, 90, 242, 0.22)");
    gPurple.addColorStop(1, "rgba(191, 90, 242, 0)");
    ctx.fillStyle = gPurple;
    ctx.fillRect(0, 0, W, H);

    const gGreen = ctx.createRadialGradient(600, 650, 20, 600, 620, 440);
    gGreen.addColorStop(0, "rgba(48, 209, 88, 0.14)");
    gGreen.addColorStop(1, "rgba(48, 209, 88, 0)");
    ctx.fillStyle = gGreen;
    ctx.fillRect(0, 0, W, H);

    // Outer subtle border frame
    drawRoundedRect(ctx, 24, 24, W - 48, H - 48, 28);
    ctx.fillStyle = "rgba(18, 21, 30, 0.72)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.stroke();

    // Header bar inside card
    ctx.fillStyle = "#30d158";
    ctx.beginPath();
    ctx.arc(76, 78, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "700 26px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#f5f5f7";
    ctx.fillText("TrueSOTA", 98, 87);

    // Plan pill
    drawRoundedRect(ctx, 224, 59, 76, 32, 16);
    ctx.fillStyle = "rgba(10, 132, 255, 0.2)";
    ctx.fill();
    ctx.strokeStyle = "rgba(10, 132, 255, 0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = "700 13px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#64b5ff";
    ctx.fillText((data.mode || "PRO").toUpperCase(), 246, 80);

    // Right timestamp pill
    const dateStr = new Date().toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    ctx.font = "500 16px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(235, 235, 245, 0.55)";
    ctx.textAlign = "right";
    ctx.fillText(`TrueSOTA Telemetry • ${dateStr}`, W - 64, 83);
    ctx.textAlign = "left";

    // Left Bento Hero Panel (Quota Ring)
    drawRoundedRect(ctx, 56, 122, 375, 342, 22);
    ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();

    const cx = 243;
    const cy = 272;
    const radius = 98;
    const pct = Math.max(0, Math.min(100, data.pctRemaining));
    const ringColor =
      pct > 50 ? "#30d158" : pct > 20 ? "#ff9f0a" : "#ff453a";

    // Track ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = 18;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();

    // Active progress arc
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * pct) / 100;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.lineCap = "round";
    ctx.lineWidth = 18;
    ctx.strokeStyle = ringColor;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = "700 44px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`$${data.remaining.toFixed(2)}`, cx, cy + 8);

    ctx.font = "600 15px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(235, 235, 245, 0.58)";
    ctx.fillText(
      `остаток из $${data.limit.toFixed(0)} (${pct.toFixed(1)}%)`,
      cx,
      cy + 36,
    );

    ctx.font = "600 15px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(235, 235, 245, 0.7)";
    ctx.fillText(`Потрачено: $${data.used.toFixed(2)}`, cx, 434);
    ctx.textAlign = "left";

    // Right 2x2 Bento Stats Grid
    const tiles = [
      {
        label: "ВСЕГО ТОКЕНОВ",
        value: fmtCompact(data.totalTokens),
        sub: `${data.totalRequests.toLocaleString("ru-RU")} запросов`,
        accent: "#0a84ff",
      },
      {
        label: "PROMPT CACHE HIT",
        value: `${data.cacheHitPct.toFixed(1)}%`,
        sub: `Кэш активен`,
        accent: "#64d2ff",
      },
      {
        label: "ЭКОНОМИЯ НА КЭШЕ",
        value: `-$${data.savedUsd.toFixed(2)}`,
        sub: "Скидка провайдера",
        accent: "#30d158",
      },
      {
        label: "СРЕДНЯЯ СКОРОСТЬ",
        value:
          data.avgDurationMs > 0
            ? `${(data.avgDurationMs / 1000).toFixed(2)}s`
            : "—",
        sub: `${data.modelStats.length} активн. моделей`,
        accent: "#bf5af2",
      },
    ];

    const gx = 456;
    const gy = 122;
    const tw = 334;
    const th = 160;
    const gap = 22;

    tiles.forEach((tile, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = gx + col * (tw + gap);
      const y = gy + row * (th + gap);

      drawRoundedRect(ctx, x, y, tw, th, 20);
      ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Accent top bar pill
      drawRoundedRect(ctx, x + 22, y + 22, 34, 4, 2);
      ctx.fillStyle = tile.accent;
      ctx.fill();

      ctx.font = "600 13px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "rgba(235, 235, 245, 0.55)";
      ctx.fillText(tile.label, x + 22, y + 52);

      ctx.font = "700 40px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(tile.value, x + 22, y + 105);

      ctx.font = "500 14px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "rgba(235, 235, 245, 0.62)";
      ctx.fillText(tile.sub, x + 22, y + 135);
    });

    // Bottom Strip: Top 3 Models
    drawRoundedRect(ctx, 56, 486, W - 112, 88, 18);
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
    ctx.stroke();

    ctx.font = "600 13px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(235, 235, 245, 0.5)";
    ctx.fillText("ТОП МОДЕЛЕЙ", 80, 514);

    const top3 = [...data.modelStats]
      .sort((a, b) => (b.actual_cost || 0) - (a.actual_cost || 0))
      .slice(0, 3);

    top3.forEach((m, i) => {
      const mx = 80 + i * 355;
      const my = 548;
      const prov = detectProvider(m.model);

      ctx.fillStyle = prov.color;
      ctx.beginPath();
      ctx.arc(mx + 6, my - 5, 5, 0, Math.PI * 2);
      ctx.fill();

      const shortName =
        m.model.length > 26 ? `${m.model.slice(0, 24)}…` : m.model;
      ctx.font = "600 16px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#f5f5f7";
      ctx.fillText(shortName, mx + 20, my);

      ctx.font = "600 15px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "rgba(235, 235, 245, 0.62)";
      ctx.fillText(`$${(m.actual_cost || 0).toFixed(2)}`, mx + 262, my);
    });

    if (top3.length === 0) {
      ctx.font = "500 15px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "rgba(235, 235, 245, 0.5)";
      ctx.fillText("Нет данных по моделям", 80, 548);
    }

    ctx.textAlign = "right";
    ctx.font = "600 13px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(84, 195, 245, 0.72)";
    ctx.fillText("by @afk3drp", W - 80, 514);
    ctx.textAlign = "left";
  }, [data]);

  useEffect(() => {
    if (open) {
      setExportNote(null);
      setExportError(null);
      const id = requestAnimationFrame(renderCardCanvas);
      return () => cancelAnimationFrame(id);
    }
  }, [open, renderCardCanvas]);

  const handleCopyPng = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setExportError(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Не удалось создать PNG");
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      appleAudio.playSuccessChime();
      setCopiedImg(true);
      setExportNote("Карточка скопирована в буфер — жми Ctrl+V в Telegram!");
      setTimeout(() => setCopiedImg(false), 2400);
    } catch (e) {
      setExportError(
        `Буфер обмена недоступен (${String(e)}). Используй «Сохранить PNG».`,
      );
    }
  };

  const handleSavePng = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setExportError(null);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1] || "";
      const stamp = new Date().toISOString().slice(0, 10);
      const savedPath = await invoke<string>("save_export_file", {
        filename: `TrueSOTA-Card-${stamp}.png`,
        content: base64,
        isBase64: true,
      });
      appleAudio.playSuccessChime();
      setExportNote(`PNG сохранён: ${savedPath}`);
    } catch (e) {
      setExportError(String(e));
    }
  };

  const handleExportCsv = async () => {
    setExportError(null);
    try {
      const csvSafe = (val: unknown): string => {
        let s = String(val ?? "");
        if (/^[=+\-@\t\r]/.test(s)) {
          s = `'${s}`;
        }
        return `"${s.replace(/"/g, '""')}"`;
      };

      const lines: string[] = [];
      lines.push("Section,DateOrModel,Requests,InputTokens,CacheReadTokens,OutputTokens,TotalTokens,NominalCostUSD,ActualCostUSD");
      for (const m of data.modelStats) {
        lines.push(
          [
            "Model",
            csvSafe(m.model),
            m.requests,
            m.input_tokens,
            m.cache_read_tokens || 0,
            m.output_tokens,
            m.total_tokens,
            (m.cost || 0).toFixed(4),
            (m.actual_cost || 0).toFixed(4),
          ].join(","),
        );
      }
      for (const d of data.dailyUsage) {
        lines.push(
          [
            "Daily",
            csvSafe(d.date),
            d.requests,
            d.input_tokens,
            d.cache_read_tokens || 0,
            d.output_tokens,
            d.total_tokens,
            (d.cost || 0).toFixed(4),
            (d.actual_cost || 0).toFixed(4),
          ].join(","),
        );
      }
      const stamp = new Date().toISOString().slice(0, 10);
      const savedPath = await invoke<string>("save_export_file", {
        filename: `TrueSOTA-Report-${stamp}.csv`,
        content: `\uFEFF${lines.join("\n")}`,
        isBase64: false,
      });
      appleAudio.playSuccessChime();
      setExportNote(`CSV отчёт сохранён: ${savedPath}`);
    } catch (e) {
      setExportError(String(e));
    }
  };

  const handleExportMarkdown = async () => {
    setExportError(null);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const md: string[] = [
        `# Отчёт TrueSOTA Usage Monitor (${stamp})`,
        "",
        "## Сводка квоты и телеметрии",
        `- **Режим:** ${(data.mode || "pro").toUpperCase()} (${data.status || "active"})`,
        `- **Остаток:** $${data.remaining.toFixed(2)} / $${data.limit.toFixed(2)} (${data.pctRemaining.toFixed(1)}%)`,
        `- **Потрачено:** $${data.used.toFixed(2)}`,
        `- **Всего токенов:** ${fmtCompact(data.totalTokens)} (${data.totalRequests} запросов)`,
        `- **Cache Hit Rate:** ${data.cacheHitPct.toFixed(1)}% (экономия $${data.savedUsd.toFixed(2)})`,
        "",
        "## Разбивка по моделям",
        "| Модель | Запросы | Токены | Кэш-чтение | Факт $ |",
        "|---|---:|---:|---:|---:|",
      ];
      const mdSafe = (val: unknown): string =>
        String(val ?? "").replace(/[\r\n|`<>]/g, " ").trim();

      for (const m of data.modelStats) {
        md.push(
          `| ${mdSafe(m.model)} | ${m.requests} | ${fmtCompact(m.total_tokens)} | ${fmtCompact(m.cache_read_tokens || 0)} | $${(m.actual_cost || 0).toFixed(3)} |`,
        );
      }
      md.push("", "## Ежедневная статистика", "| Дата | Запросы | Токены | Расход $ |", "|---|---:|---:|---:|");
      for (const d of data.dailyUsage.slice(-30)) {
        md.push(
          `| ${mdSafe(d.date)} | ${d.requests} | ${fmtCompact(d.total_tokens)} | $${(d.actual_cost || d.cost || 0).toFixed(3)} |`,
        );
      }

      const savedPath = await invoke<string>("save_export_file", {
        filename: `TrueSOTA-Report-${stamp}.md`,
        content: md.join("\n"),
        isBase64: false,
      });
      appleAudio.playSuccessChime();
      setExportNote(`Markdown отчёт сохранён: ${savedPath}`);
    } catch (e) {
      setExportError(String(e));
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <div className="share-modal-title">
            <Sparkles size={15} style={{ color: "var(--apple-blue)" }} />
            <span>Apple Share Card & Экспорт отчётов</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={15} />
          </button>
        </div>

        <div className="share-canvas-wrap">
          <canvas ref={canvasRef} className="share-canvas-preview" />
        </div>

        <div className="share-actions-bar">
          <button
            type="button"
            className="primary-btn share-btn-primary"
            onClick={handleCopyPng}
          >
            {copiedImg ? <Check size={14} /> : <Copy size={14} />}
            <span>
              {copiedImg ? "Скопировано!" : "Копировать PNG в Telegram"}
            </span>
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={handleSavePng}
          >
            <Download size={14} />
            <span>Сохранить PNG</span>
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={handleExportCsv}
          >
            <FileSpreadsheet size={14} />
            <span>CSV (Excel)</span>
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={handleExportMarkdown}
          >
            <FileText size={14} />
            <span>Markdown</span>
          </button>
        </div>

        {exportNote && <div className="share-feedback ok">{exportNote}</div>}
        {exportError && (
          <div className="share-feedback err">{exportError}</div>
        )}
      </div>
    </div>
  );
};
