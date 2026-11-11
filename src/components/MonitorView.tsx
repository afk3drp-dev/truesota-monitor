import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Activity,
  ExternalLink,
  Home,
  Pause,
  Play,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { appleAudio } from "../utils/audio";

export interface GatewayPingResult {
  ok: boolean;
  status_code: number;
  latency_ms: number;
  endpoint: string;
  models_count: number;
  authenticated: boolean;
  error: string | null;
}

interface MonitorViewProps {
  apiKey: string;
  isVisible: boolean;
  onSyncTrigger?: number;
  onPingResult?: (res: GatewayPingResult) => void;
}

export const MonitorView: React.FC<MonitorViewProps> = ({
  apiKey,
  isVisible,
  onSyncTrigger = 0,
  onPingResult,
}) => {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const wantVisibleRef = useRef<boolean>(false);

  const [embedEnabled, setEmbedEnabled] = useState<boolean>(true);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [embedReady, setEmbedReady] = useState<boolean>(false);

  const [pingResult, setPingResult] = useState<GatewayPingResult | null>(null);
  const [pingHistory, setPingHistory] = useState<number[]>([]);
  const [pinging, setPinging] = useState<boolean>(false);
  const [autoPing, setAutoPing] = useState<boolean>(true);

  const shouldShowEmbed = isVisible && embedEnabled;
  wantVisibleRef.current = shouldShowEmbed;

  const syncBounds = useCallback(async () => {
    const visible = wantVisibleRef.current;
    const el = slotRef.current;

    if (!visible || !el) {
      try {
        await invoke("sync_monitor_embed", {
          visible: false,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        });
      } catch {
        // ignore hide errors on unmount
      }
      return;
    }

    const rect = el.getBoundingClientRect();
    const x = Math.round(rect.left + 1);
    const y = Math.round(rect.top + 1);
    const width = Math.max(0, Math.round(rect.width - 2));
    const height = Math.max(0, Math.round(rect.height - 2));

    if (width < 40 || height < 40) {
      return;
    }

    try {
      await invoke("sync_monitor_embed", {
        visible: true,
        x,
        y,
        width,
        height,
      });
      // Guard against tab switch while async creation was in flight
      if (!wantVisibleRef.current) {
        await invoke("sync_monitor_embed", {
          visible: false,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        });
      } else {
        setEmbedReady(true);
        setEmbedError(null);
      }
    } catch (e: unknown) {
      setEmbedError(String(e));
    }
  }, []);

  useEffect(() => {
    let rafId = requestAnimationFrame(() => {
      void syncBounds();
    });

    const el = slotRef.current;
    const ro =
      el && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
              void syncBounds();
            });
          })
        : null;

    if (el && ro) {
      ro.observe(el);
    }

    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        void syncBounds();
      });
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
      void invoke("sync_monitor_embed", {
        visible: false,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      }).catch(() => {});
    };
  }, [syncBounds, shouldShowEmbed, onSyncTrigger]);

  const runGatewayPing = useCallback(async () => {
    setPinging(true);
    try {
      const res = await invoke<GatewayPingResult>("ping_gateway", {
        apiKey: apiKey.trim() || null,
      });
      setPingResult(res);
      setPingHistory((prev) => [...prev.slice(-19), res.latency_ms]);
      onPingResult?.(res);
    } catch (e: unknown) {
      const fallbackRes: GatewayPingResult = {
        ok: false,
        status_code: 0,
        latency_ms: 0,
        endpoint: "/v1/models",
        models_count: 0,
        authenticated: Boolean(apiKey.trim()),
        error: String(e),
      };
      setPingResult(fallbackRes);
      onPingResult?.(fallbackRes);
    } finally {
      setPinging(false);
    }
  }, [apiKey, onPingResult]);

  useEffect(() => {
    void runGatewayPing();
    if (!autoPing) return;
    const timer = window.setInterval(() => {
      void runGatewayPing();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [runGatewayPing, autoPing]);

  const avgLatency = useMemo(() => {
    if (pingHistory.length === 0) return null;
    const total = pingHistory.reduce((acc, v) => acc + v, 0);
    return Math.round(total / pingHistory.length);
  }, [pingHistory]);

  const sparklinePoints = useMemo(() => {
    if (pingHistory.length < 2) return "";
    const min = Math.min(...pingHistory);
    const max = Math.max(...pingHistory);
    const range = Math.max(1, max - min);
    const w = 112;
    const h = 24;
    return pingHistory
      .map((val, i) => {
        const px = (i / (pingHistory.length - 1)) * w;
        const py = h - 3 - ((val - min) / range) * (h - 6);
        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(" ");
  }, [pingHistory]);

  const handleReloadEmbed = async () => {
    appleAudio.playTap();
    void runGatewayPing();
    try {
      await invoke("reload_monitor_embed");
    } catch (e: unknown) {
      setEmbedError(String(e));
    }
  };

  const handleHomeMonitor = async () => {
    appleAudio.playTap();
    try {
      await invoke("navigate_monitor_embed", {
        url: "https://true-sota.com/monitor",
      });
    } catch (e: unknown) {
      setEmbedError(String(e));
    }
  };

  const handleOpenWindow = async () => {
    appleAudio.playTap();
    try {
      await invoke("open_monitor_window");
    } catch (e: unknown) {
      setEmbedError(String(e));
    }
  };

  return (
    <div className="monitor-tab-layout">
      {/* Live Gateway Probe & WebView Toolbar */}
      <div className="bento-card monitor-toolbar-card">
        <div className="monitor-probe-left">
          <div className={`monitor-status-dot ${pingResult?.ok ? "ok" : pingResult ? "down" : ""}`} />
          <div className="monitor-probe-meta">
            <div className="monitor-probe-title-row">
              {pingResult?.ok ? (
                <Wifi size={13} className="probe-icon ok" />
              ) : (
                <WifiOff size={13} className="probe-icon down" />
              )}
              <span className="monitor-probe-name">
                API Шлюз {pingResult?.endpoint || "/v1/models"}
              </span>
              {pingResult && (
                <span className={`monitor-http-pill ${pingResult.ok ? "ok" : "err"}`}>
                  {pingResult.ok
                    ? `${pingResult.status_code} • ${pingResult.latency_ms} ms`
                    : pingResult.error || `HTTP ${pingResult.status_code}`}
                </span>
              )}
              {avgLatency != null && (
                <span className="monitor-avg-pill">ср. {avgLatency} ms</span>
              )}
              {pingResult?.models_count ? (
                <span className="monitor-avg-pill">{pingResult.models_count} моделей</span>
              ) : null}
            </div>
            <span className="monitor-probe-hint">
              Встроенный live-монитор true-sota.com/monitor — войдите один раз при запросе,
              сессия сохраняется локально в WebView2
            </span>
          </div>
        </div>

        <div className="monitor-probe-right">
          {sparklinePoints && (
            <svg
              className="monitor-sparkline"
              viewBox="0 0 112 24"
              width="112"
              height="24"
              aria-label="График задержки шлюза"
            >
              <polyline
                fill="none"
                stroke={pingResult?.ok ? "#30d158" : "#ff9f0a"}
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={sparklinePoints}
              />
            </svg>
          )}

          <button
            type="button"
            className={`pricing-toggle-btn ${autoPing ? "active" : ""}`}
            onClick={() => {
              appleAudio.playTap();
              setAutoPing((p) => !p);
            }}
            title={autoPing ? "Пауза авто-пинга (10с)" : "Включить авто-пинг (10с)"}
          >
            {autoPing ? <Pause size={12} /> : <Play size={12} />}
            <span>10с</span>
          </button>

          <button
            type="button"
            className="pricing-toggle-btn"
            onClick={handleHomeMonitor}
            title="Вернуться на /monitor"
          >
            <Home size={13} />
            <span>/monitor</span>
          </button>

          <button
            type="button"
            className="pricing-refresh-btn"
            onClick={handleReloadEmbed}
            disabled={pinging}
            title="Обновить встроенный монитор и проверить пинг"
          >
            <RefreshCw size={13} className={pinging ? "spin" : ""} />
            <span>Обновить</span>
          </button>

          <button
            type="button"
            className="mac-btn-accent monitor-popout-btn"
            onClick={handleOpenWindow}
            title="Открыть в отдельном окне приложения"
          >
            <ExternalLink size={12} />
            <span>Окно</span>
          </button>
        </div>
      </div>

      {embedError && (
        <div className="bento-card pricing-error-box">
          <Activity size={15} />
          <span>{embedError}</span>
        </div>
      )}

      {/* Embedded Native Child WebView Slot */}
      <div className="monitor-embed-frame" ref={slotRef}>
        <div className="monitor-embed-placeholder">
          <Activity size={24} className="placeholder-pulse" />
          <div className="placeholder-title">
            {shouldShowEmbed
              ? embedReady
                ? "Live-монитор активен"
                : "Подключение к https://true-sota.com/monitor..."
              : "Встроенный экран скрыт"}
          </div>
          <p className="placeholder-sub">
            Если открыто окно входа, авторизуйтесь вручную (и подтвердите Turnstile при
            необходимости). Далее таблица стабильности каналов будет обновляться прямо
            здесь в реальном времени.
          </p>
          <div className="placeholder-actions">
            <button
              type="button"
              className="pricing-toggle-btn"
              onClick={() => {
                appleAudio.playTap();
                setEmbedEnabled((v) => !v);
              }}
            >
              <span>{embedEnabled ? "Скрыть встроенный экран" : "Показать встроенный экран"}</span>
            </button>
            <button
              type="button"
              className="mac-btn-accent"
              onClick={handleOpenWindow}
            >
              Открыть в отдельном окне
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
