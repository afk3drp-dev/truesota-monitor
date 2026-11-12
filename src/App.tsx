import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  Clock,
  Cpu,
  BarChart3,
  TrendingUp,
  AlertCircle,
  SlidersHorizontal,
  ChevronRight,
  Database,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Layers,
  Zap,
  PiggyBank,
  Hourglass,
  Search,
  Calendar,
  Share2,
  Command,
  LogOut,
  Activity,
  BellOff,
  ShieldCheck,
  Power,
  ArrowUpCircle,
} from "lucide-react";
import { AnimatedNumber } from "./components/AnimatedNumber";
import { ModelDonutChart } from "./components/ModelDonutChart";
import { ModelLogo, detectProvider } from "./components/ModelLogo";
import { ActivityHeatmap } from "./components/ActivityHeatmap";
import { PricingCatalog } from "./components/PricingCatalog";
import { MonitorView, type GatewayPingResult } from "./components/MonitorView";
import { ShareCardModal } from "./components/ShareCardModal";
import {
  CommandPalette,
  AppTab,
  BackdropMode,
} from "./components/CommandPalette";
import { WelcomeAuth } from "./components/WelcomeAuth";
import { TelegramCredit } from "./components/TelegramCredit";
import CometDial from "./components/reactbits/CometDial";
import SpecularButton from "./components/reactbits/SpecularButton";
import {
  AnimatedBell,
  AnimatedDownload,
  AnimatedRefreshCw,
  AnimatedSparkles,
} from "./components/ui/AnimatedIcons";
import { SmoothTab, type SmoothTabItem } from "./components/ui/SmoothTab";
import { ProfileDropdown } from "./components/ui/ProfileDropdown";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from "./components/ui/Accordion";
import { appleAudio } from "./utils/audio";
import "./App.css";

interface DailyUsageItem {
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

interface ModelStatItem {
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

interface TrueSotaResponse {
  mode?: string;
  status?: string;
  isValid?: boolean;
  unit?: string;
  quota?: {
    limit: number;
    remaining: number;
    unit?: string;
    used: number;
  };
  balance?: number;
  remaining?: number;
  usage?: {
    average_duration_ms?: number;
    rpm?: number;
    tpm?: number;
    today?: {
      actual_cost?: number;
      cost?: number;
      requests?: number;
      input_tokens?: number;
      output_tokens?: number;
      cache_read_tokens?: number;
      cache_creation_tokens?: number;
      total_tokens?: number;
    };
    total?: {
      actual_cost?: number;
      cost?: number;
      requests?: number;
      input_tokens?: number;
      output_tokens?: number;
      cache_read_tokens?: number;
      cache_creation_tokens?: number;
      total_tokens?: number;
    };
  };
  model_stats?: ModelStatItem[];
  daily_usage?: DailyUsageItem[];
}

interface KeyStorageStatus {
  has_key: boolean;
  protected: boolean;
  method: string;
}

interface NativeSettingsState {
  close_to_tray: boolean;
  autostart: boolean;
}

type WindowLayout = "portrait" | "fullscreen" | "wide" | "compact_win";

interface UpdateCheckResult {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  release_url: string;
  release_name: string;
  published_at: string;
  notes_preview: string;
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

type ChartMetric = "cost" | "requests" | "tokens";
type ChartViewMode = "area" | "bars";

function getChartMetricValue(day: DailyUsageItem, metric: ChartMetric): number {
  if (metric === "requests") return day.requests || 0;
  if (metric === "tokens") return day.total_tokens || 0;
  return day.actual_cost ?? day.cost ?? 0;
}

/** Builds smooth cubic Bezier SVG paths (stroke + closed bottom area) for telemetry sparklines. */
function buildSmoothCurvePaths(
  points: { x: number; y: number }[],
  baselineY: number
): { linePath: string; areaPath: string } {
  if (points.length === 0) return { linePath: "", areaPath: "" };
  if (points.length === 1) {
    const p = points[0];
    return {
      linePath: `M ${p.x} ${p.y}`,
      areaPath: `M ${p.x} ${baselineY} L ${p.x} ${p.y} L ${p.x} ${baselineY} Z`,
    };
  }
  const cmds: string[] = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    cmds.push(
      `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
    );
  }
  const linePath = cmds.join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const areaPath = `${linePath} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} L ${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
  return { linePath, areaPath };
}

function createBrowserPreviewData(): TrueSotaResponse {
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(Date.now() - (13 - i) * 86400_000).toISOString().slice(0, 10);
    const wave = [14.2, 18.8, 12.1, 24.5, 31.4, 21.8, 16.4, 28.9, 36.2, 44.1, 22.6, 19.3, 27.8, 18.4][i];
    const reqs = Math.round(wave * 11.4);
    return {
      date,
      requests: reqs,
      input_tokens: Math.round(reqs * 4200),
      output_tokens: Math.round(reqs * 890),
      cache_read_tokens: Math.round(reqs * 21000),
      total_tokens: Math.round(reqs * 26090),
      cost: Number((wave * 2.15).toFixed(2)),
      actual_cost: wave,
    };
  });
  return {
    mode: "quota",
    status: "active",
    isValid: true,
    unit: "USD",
    quota: { limit: 500, remaining: 214.65, used: 285.35, unit: "USD" },
    usage: {
      average_duration_ms: 18400,
      rpm: 4,
      tpm: 184200,
      today: {
        actual_cost: 18.4,
        cost: 41.9,
        requests: 210,
        input_tokens: 882000,
        output_tokens: 186900,
        cache_read_tokens: 28200000,
        total_tokens: 31200000,
      },
      total: {
        actual_cost: 285.35,
        cost: 612.4,
        requests: 12480,
        input_tokens: 274000000,
        output_tokens: 9400000,
        cache_read_tokens: 2556000000,
        total_tokens: 2839400000,
      },
    },
    model_stats: [
      { model: "claude-opus-4-6", requests: 4120, input_tokens: 128000000, output_tokens: 4100000, cache_read_tokens: 1200000000, total_tokens: 1332100000, cost: 288.4, actual_cost: 132.45 },
      { model: "claude-sonnet-4-5", requests: 3890, input_tokens: 92000000, output_tokens: 3200000, cache_read_tokens: 980000000, total_tokens: 1075200000, cost: 164.2, actual_cost: 76.2 },
      { model: "gpt-5.3-codex", requests: 2140, input_tokens: 34000000, output_tokens: 1250000, cache_read_tokens: 260000000, total_tokens: 295250000, cost: 88.5, actual_cost: 42.15 },
      { model: "gemini-3-pro-preview", requests: 1410, input_tokens: 14000000, output_tokens: 540000, cache_read_tokens: 90000000, total_tokens: 104540000, cost: 48.3, actual_cost: 21.9 },
      { model: "gpt-5", requests: 640, input_tokens: 4500000, output_tokens: 220000, cache_read_tokens: 21000000, total_tokens: 25720000, cost: 16.4, actual_cost: 8.95 },
      { model: "gemini-2.5-flash", requests: 280, input_tokens: 1500000, output_tokens: 90000, cache_read_tokens: 5000000, total_tokens: 6590000, cost: 6.6, actual_cost: 3.7 },
    ],
    daily_usage: days,
  };
}

export default function App() {
  const [data, setData] = useState<TrueSotaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [keyLoaded, setKeyLoaded] = useState<boolean>(false);
  const skipNextLoadRef = useRef<boolean>(false);
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [copiedModelId, setCopiedModelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("overview");
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(60000);

  // Kinetic & Interactive States
  const [isIslandMode, setIsIslandMode] = useState<boolean>(false);
  const [isIslandExpanded, setIsIslandExpanded] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(appleAudio.enabled);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("cost");
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>(() => {
    return localStorage.getItem("truesota_chart_mode") === "bars" ? "bars" : "area";
  });
  const [hoveredDay, setHoveredDay] = useState<DailyUsageItem | null>(null);
  const [modelSearch, setModelSearch] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState<string>("all");

  // Flagship Feature States (Mica/Acrylic, Ctrl+K, Share Card)
  const [backdropMode, setBackdropMode] = useState<BackdropMode>(() => {
    const saved = localStorage.getItem("truesota_backdrop");
    if (saved === "mica" || saved === "acrylic" || saved === "tabbed" || saved === "oled") {
      return saved;
    }
    return "oled";
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);

  // Security (DPAPI), Tray, Autostart, Alerts & Auto-Update States
  const [keyStorage, setKeyStorage] = useState<KeyStorageStatus>({
    has_key: false,
    protected: true,
    method: "Windows DPAPI",
  });
  const [nativePrefs, setNativePrefs] = useState<NativeSettingsState>({
    close_to_tray: true,
    autostart: false,
  });
  const [alertThresholdPct, setAlertThresholdPct] = useState<number>(() => {
    const saved = Number(localStorage.getItem("truesota_alert_threshold_pct"));
    return Number.isFinite(saved) && saved >= 0 && saved <= 50 ? saved : 15;
  });
  const [gatewayAlertEnabled, setGatewayAlertEnabled] = useState<boolean>(() => {
    return localStorage.getItem("truesota_alert_gateway") !== "false";
  });
  const [autoCheckUpdates, setAutoCheckUpdates] = useState<boolean>(() => {
    return localStorage.getItem("truesota_auto_check_updates") !== "false";
  });
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState<boolean>(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState<boolean>(false);
  const [monitorSyncTick, setMonitorSyncTick] = useState<number>(0);
  const [windowLayout, setWindowLayout] = useState<WindowLayout>(() => {
    const saved = localStorage.getItem("truesota_window_layout");
    if (
      saved === "portrait" ||
      saved === "fullscreen" ||
      saved === "wide" ||
      saved === "compact_win"
    ) {
      return saved;
    }
    return "portrait";
  });
  const [isWindowMaximized, setIsWindowMaximized] = useState<boolean>(false);

  const lowAlertFiredRef = useRef<boolean>(false);
  const lastGatewayOkRef = useRef<boolean | null>(null);
  const lastGatewayAlertAtRef = useRef<number>(0);
  const loadDataRef = useRef<(() => void) | null>(null);
  const toggleIslandRef = useRef<(() => void) | null>(null);
  const viewportRef = useRef<HTMLElement | null>(null);

  // Initialize API Key, DPAPI Status, Native Preferences & Backdrop Material
  useEffect(() => {
    async function initApp() {
      const isBrowserPreview =
        typeof window !== "undefined" &&
        !("__TAURI_INTERNALS__" in window) &&
        new URLSearchParams(window.location.search).get("demo") === "1";

      if (isBrowserPreview) {
        const preview = createBrowserPreviewData();
        const qs = new URLSearchParams(window.location.search);
        skipNextLoadRef.current = true;
        setApiKey("cr_preview_demo_key_9f8a7b");
        setKeyInput("cr_preview_demo_key_9f8a7b");
        setKeyLoaded(true);
        setData(preview);
        setLastUpdated("00:26:41");
        if (qs.get("island") === "1") {
          setIsIslandMode(true);
          setIsIslandExpanded(qs.get("expanded") !== "0");
        }
        const tabParam = qs.get("tab") as AppTab | null;
        if (tabParam && ["overview", "pricing", "monitor", "analytics", "models", "history", "settings"].includes(tabParam)) {
          setActiveTab(tabParam);
        }
        return;
      }

      try {
        const key = await invoke<string>("get_api_key");
        setApiKey(key.trim());
        setKeyInput(key.trim());
      } catch (e) {
        console.error("Failed to load API key", e);
      } finally {
        setKeyLoaded(true);
      }
      try {
        const status = await invoke<KeyStorageStatus>("get_key_storage_status");
        setKeyStorage(status);
      } catch {
        // fallback handled cleanly
      }
      try {
        const prefs = await invoke<NativeSettingsState>("get_app_preferences");
        setNativePrefs(prefs);
      } catch {
        // fallback defaults
      }
      try {
        await invoke("set_window_vibrancy", {
          effect: backdropMode === "oled" ? "none" : backdropMode,
        });
      } catch (e) {
        console.warn("Vibrancy unsupported on host OS", e);
      }
      try {
        if (windowLayout !== "fullscreen") {
          const isMax = await invoke<boolean>("set_window_layout", { layout: windowLayout });
          setIsWindowMaximized(isMax);
        } else {
          const isMax = await invoke<boolean>("get_window_is_maximized");
          setIsWindowMaximized(isMax);
        }
      } catch {
        // running outside Tauri webview (browser preview)
      }
    }
    initApp();

    const syncMaxState = () => {
      void invoke<boolean>("get_window_is_maximized")
        .then((isMax) => setIsWindowMaximized(isMax))
        .catch(() => {});
    };
    window.addEventListener("resize", syncMaxState);
    return () => {
      window.removeEventListener("resize", syncMaxState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global Ctrl+K / Cmd+K Spotlight Shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!apiKey) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        appleAudio.playTap();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [apiKey]);

  const notifyWindows = useCallback(async (title: string, body: string) => {
    try {
      await invoke("send_windows_notification", { title, body });
    } catch (e) {
      console.warn("Windows toast notification failed", e);
    }
  }, []);

  const handleGatewayStatus = useCallback(
    (res: GatewayPingResult) => {
      const prev = lastGatewayOkRef.current;
      lastGatewayOkRef.current = res.ok;
      if (!gatewayAlertEnabled) return;

      const now = Date.now();
      if (!res.ok) {
        const shouldAlert =
          prev === true || (prev === null && now - lastGatewayAlertAtRef.current > 600_000);
        if (shouldAlert && now - lastGatewayAlertAtRef.current > 600_000) {
          lastGatewayAlertAtRef.current = now;
          void notifyWindows(
            "API-шлюз TrueSOTA недоступен",
            res.error || `Код ответа ${res.status_code || "таймаут"}. Проверьте вкладку «Монитор».`
          );
        }
      } else if (prev === false) {
        lastGatewayAlertAtRef.current = 0;
        void notifyWindows(
          "API-шлюз TrueSOTA восстановлен",
          `Соединение стабильно (${res.latency_ms} мс).`
        );
      }
    },
    [gatewayAlertEnabled, notifyWindows]
  );

  const applyUsageAlertsAndTray = useCallback(
    (res: TrueSotaResponse) => {
      const lim = res.quota?.limit ?? 0;
      const rem = res.quota?.remaining ?? res.remaining ?? res.balance ?? 0;
      const pct = lim > 0 ? Math.min(100, Math.max(0, (rem / lim) * 100)) : 0;

      const tip =
        lim > 0
          ? `TrueSOTA Monitor • $${rem.toFixed(2)} (${pct.toFixed(0)}%)`
          : `TrueSOTA Monitor • $${rem.toFixed(2)}`;
      void invoke("update_tray_status", { summary: tip }).catch(() => {});

      if (alertThresholdPct > 0 && lim > 0) {
        if (pct <= alertThresholdPct) {
          if (!lowAlertFiredRef.current) {
            lowAlertFiredRef.current = true;
            void notifyWindows(
              "Низкий остаток квоты TrueSOTA",
              `Осталось $${rem.toFixed(2)} (${pct.toFixed(1)}%) — ниже порога ${alertThresholdPct}%.`
            );
          }
        } else if (pct > alertThresholdPct + 3) {
          lowAlertFiredRef.current = false;
        }
      }
    },
    [alertThresholdPct, notifyWindows]
  );

  const loadData = useCallback(async (currentKey?: string) => {
    const active = (currentKey || apiKey || "").trim();
    if (!active) return;
    setLoading(true);
    setError(null);
    try {
      const res = await invoke<TrueSotaResponse>("fetch_usage", {
        apiKey: active,
      });
      setData(res);
      applyUsageAlertsAndTray(res);
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      appleAudio.playSuccessChime();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [apiKey, applyUsageAlertsAndTray]);

  useEffect(() => {
    if (!apiKey) return;
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }
    loadData(apiKey);
  }, [apiKey, loadData]);

  useEffect(() => {
    if (!apiKey || autoRefreshInterval <= 0) return;
    const timer = setInterval(() => {
      loadData();
      if (gatewayAlertEnabled && activeTab !== "monitor") {
        void invoke<GatewayPingResult>("ping_gateway", { apiKey })
          .then(handleGatewayStatus)
          .catch(() => {});
      }
    }, autoRefreshInterval);
    return () => clearInterval(timer);
  }, [apiKey, autoRefreshInterval, loadData, gatewayAlertEnabled, activeTab, handleGatewayStatus]);

  const handleCheckUpdates = useCallback(async (silent = false) => {
    setCheckingUpdate(true);
    if (!silent) setUpdateError(null);
    try {
      const res = await invoke<UpdateCheckResult>("check_app_update");
      setUpdateInfo(res);
      setUpdateError(null);
      if (res.has_update) {
        setUpdateDismissed(false);
      }
    } catch (e) {
      if (!silent) {
        setUpdateError(String(e));
      }
    } finally {
      setCheckingUpdate(false);
    }
  }, []);

  useEffect(() => {
    if (!autoCheckUpdates) return;
    const timer = window.setTimeout(() => {
      void handleCheckUpdates(true);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [autoCheckUpdates, handleCheckUpdates]);

  const handleOpenUpdateRelease = async () => {
    appleAudio.playTap();
    const url = updateInfo?.release_url || "https://github.com/afk3drp-dev/truesota-monitor/releases";
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleAuthenticated = async (newKey: string, initialData: unknown | null) => {
    if (initialData) {
      skipNextLoadRef.current = true;
      const typed = initialData as TrueSotaResponse;
      setData(typed);
      applyUsageAlertsAndTray(typed);
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }
    setError(null);
    setActiveTab("overview");
    setKeyInput(newKey);
    setApiKey(newKey);
    try {
      const status = await invoke<KeyStorageStatus>("get_key_storage_status");
      setKeyStorage(status);
    } catch {
      // ignore
    }
  };

  const handleSignOut = async () => {
    appleAudio.playSwitch();
    try {
      await invoke("sync_monitor_embed", {
        visible: false,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });
    } catch {
      // ignore if embed was not initialized
    }
    try {
      await invoke("clear_api_key");
      const status = await invoke<KeyStorageStatus>("get_key_storage_status");
      setKeyStorage(status);
    } catch (e) {
      console.error("Failed to clear API key", e);
    }
    void invoke("update_tray_status", { summary: "TrueSOTA Monitor • Ожидание входа" }).catch(() => {});
    setCommandPaletteOpen(false);
    setShareModalOpen(false);
    setActiveTab("overview");
    setData(null);
    setError(null);
    setLastUpdated("");
    setKeyInput("");
    setApiKey("");
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    appleAudio.setEnabled(next);
    setSoundEnabled(next);
    if (next) appleAudio.playTap();
  };

  const handleSelectBackdrop = async (mode: BackdropMode) => {
    appleAudio.playTap();
    setBackdropMode(mode);
    localStorage.setItem("truesota_backdrop", mode);
    try {
      await invoke("set_window_vibrancy", {
        effect: mode === "oled" ? "none" : mode,
      });
    } catch (e) {
      console.error("Failed to switch backdrop", e);
    }
  };

  const handleToggleMaximize = async () => {
    appleAudio.playTap();
    try {
      const nowMax = await invoke<boolean>("window_toggle_maximize");
      setIsWindowMaximized(nowMax);
      const nextLayout: WindowLayout = nowMax ? "fullscreen" : "portrait";
      setWindowLayout(nextLayout);
      localStorage.setItem("truesota_window_layout", nextLayout);
      setMonitorSyncTick((n) => n + 1);
    } catch (e) {
      console.error("Failed to toggle maximize", e);
    }
  };

  const handleSelectWindowLayout = async (layout: WindowLayout) => {
    appleAudio.playTap();
    setWindowLayout(layout);
    localStorage.setItem("truesota_window_layout", layout);
    if (isIslandMode) return;
    try {
      const nowMax = await invoke<boolean>("set_window_layout", { layout });
      setIsWindowMaximized(nowMax);
      setMonitorSyncTick((n) => n + 1);
    } catch (e) {
      console.error("Failed to apply window layout", e);
    }
  };

  const handleTitlebarDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, input, select, a, .backdrop-segmented")) {
      return;
    }
    void handleToggleMaximize();
  };

  const toggleIslandMode = async () => {
    appleAudio.playSwitch();
    const next = !isIslandMode;
    setIsIslandMode(next);
    setIsIslandExpanded(false);
    if (next) {
      setCommandPaletteOpen(false);
      setShareModalOpen(false);
      setIsWindowMaximized(false);
    }
    try {
      const nowMax = await invoke<boolean>("set_window_mode", {
        mode: next ? "compact" : "normal",
        vibrancy: next ? null : backdropMode === "oled" ? "none" : backdropMode,
        layout: next ? null : windowLayout,
      });
      if (!next) {
        setIsWindowMaximized(nowMax);
        setMonitorSyncTick((n) => n + 1);
      }
    } catch (e) {
      console.error("Failed to set window mode", e);
    }
  };

  loadDataRef.current = () => {
    void loadData();
  };
  toggleIslandRef.current = () => {
    void toggleIslandMode();
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      return;
    }
    const unlistenPromises = [
      listen("tray-refresh", () => {
        loadDataRef.current?.();
      }),
      listen("tray-toggle-island", () => {
        toggleIslandRef.current?.();
      }),
      listen("tray-restore", () => {
        setMonitorSyncTick((n) => n + 1);
      }),
    ];
    return () => {
      for (const p of unlistenPromises) {
        void p.then((unlisten) => unlisten());
      }
    };
  }, []);

  const toggleIslandExpanded = async () => {
    appleAudio.playTap();
    const next = !isIslandExpanded;
    setIsIslandExpanded(next);
    try {
      await invoke("set_compact_expanded", { expanded: next });
    } catch (e) {
      console.error("Failed to set compact size", e);
    }
  };

  const handleTabChange = (tab: AppTab) => {
    appleAudio.playTap();
    setActiveTab(tab);
    viewportRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveKey = async () => {
    if (!keyInput.trim()) {
      setError("Ключ не может быть пустым");
      return;
    }
    try {
      await invoke<string>("save_api_key", { key: keyInput.trim() });
      const status = await invoke<KeyStorageStatus>("get_key_storage_status");
      setKeyStorage(status);
      setApiKey(keyInput.trim());
      appleAudio.playSuccessChime();
      loadData(keyInput.trim());
    } catch (e) {
      setError(String(e));
    }
  };

  const handleToggleAutostart = async () => {
    appleAudio.playTap();
    const next = !nativePrefs.autostart;
    try {
      const actual = await invoke<boolean>("set_autostart", { enabled: next });
      setNativePrefs((p) => ({ ...p, autostart: actual }));
    } catch (e) {
      setError(String(e));
    }
  };

  const handleToggleCloseToTray = async () => {
    appleAudio.playTap();
    const next = !nativePrefs.close_to_tray;
    try {
      const actual = await invoke<boolean>("set_close_to_tray", { enabled: next });
      setNativePrefs((p) => ({ ...p, close_to_tray: actual }));
    } catch (e) {
      setError(String(e));
    }
  };

  const handleSelectAlertThreshold = (pct: number) => {
    appleAudio.playTap();
    lowAlertFiredRef.current = false;
    setAlertThresholdPct(pct);
    localStorage.setItem("truesota_alert_threshold_pct", String(pct));
  };

  const handleToggleGatewayAlert = () => {
    appleAudio.playTap();
    const next = !gatewayAlertEnabled;
    setGatewayAlertEnabled(next);
    localStorage.setItem("truesota_alert_gateway", String(next));
  };

  const handleToggleAutoUpdates = () => {
    appleAudio.playTap();
    const next = !autoCheckUpdates;
    setAutoCheckUpdates(next);
    localStorage.setItem("truesota_auto_check_updates", String(next));
  };

  const handleTestNotification = async () => {
    appleAudio.playTap();
    await notifyWindows(
      "TrueSOTA Usage Monitor",
      "Системные уведомления Windows работают корректно."
    );
  };

  const handleCopyReport = () => {
    if (!data) return;
    appleAudio.playTap();
    const lim = data.quota?.limit ?? 0;
    const rem = data.quota?.remaining ?? data.remaining ?? data.balance ?? 0;
    const usd = data.quota?.used ?? 0;
    const tdReq = data.usage?.today?.requests ?? 0;
    const tdCost = data.usage?.today?.actual_cost ?? data.usage?.today?.cost ?? 0;

    const text = `=== TrueSOTA Usage Report ===\nСтатус: ${data.status || "active"} | Режим: ${data.mode || "quota"}\nКвота: $${rem.toFixed(2)} из $${lim.toFixed(2)} (потрачено $${usd.toFixed(2)})\nСегодня: ${tdReq} запросов на $${tdCost.toFixed(2)}\nОбновлено: ${lastUpdated}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyModelId = (modelId: string) => {
    appleAudio.playTap();
    void navigator.clipboard.writeText(modelId);
    setCopiedModelId(modelId);
    window.setTimeout(() => {
      setCopiedModelId((prev) => (prev === modelId ? null : prev));
    }, 1600);
  };

  const handleSelectChartViewMode = (mode: ChartViewMode) => {
    appleAudio.playTap();
    setChartViewMode(mode);
    localStorage.setItem("truesota_chart_mode", mode);
  };

  // Core Quota Metrics
  const limit = data?.quota?.limit ?? 450.0;
  const remaining = data?.quota?.remaining ?? data?.remaining ?? data?.balance ?? 0;
  const used = data?.quota?.used ?? Math.max(0, limit - remaining);
  const percent = limit > 0 ? Math.min(100, Math.max(0, (remaining / limit) * 100)) : 0;

  // Today Metrics
  const todayCost = data?.usage?.today?.actual_cost ?? data?.usage?.today?.cost ?? 0;
  const todayNominal = data?.usage?.today?.cost ?? todayCost;
  const todayReq = data?.usage?.today?.requests ?? 0;
  const todayTokens = data?.usage?.today?.total_tokens ?? 0;
  const todayCacheRead = data?.usage?.today?.cache_read_tokens ?? 0;
  const todaySavingsPct = todayNominal > todayCost && todayNominal > 0
    ? Math.round(((todayNominal - todayCost) / todayNominal) * 100)
    : 0;

  // Total Metrics
  const totalCost = data?.usage?.total?.actual_cost ?? data?.usage?.total?.cost ?? 0;
  const totalNominal = data?.usage?.total?.cost ?? totalCost;
  const totalSaved = Math.max(0, totalNominal - totalCost);
  const totalSavedPct = totalNominal > 0 ? (totalSaved / totalNominal) * 100 : 0;
  const totalReq = data?.usage?.total?.requests ?? 0;
  const totalTokens = data?.usage?.total?.total_tokens ?? 0;
  const totalInputTokens = data?.usage?.total?.input_tokens ?? 0;
  const totalOutputTokens = data?.usage?.total?.output_tokens ?? 0;
  const totalCacheRead = data?.usage?.total?.cache_read_tokens ?? 0;
  const cacheHitPct = totalTokens > 0 ? (totalCacheRead / totalTokens) * 100 : 0;

  const rpm = data?.usage?.rpm ?? 0;
  const tpm = data?.usage?.tpm ?? 0;
  const avgDurationSec = (data?.usage?.average_duration_ms ?? 0) / 1000;
  const avgCostPerReq = totalReq > 0 ? totalCost / totalReq : 0;

  // Daily Chart & Burn-rate Forecast
  const chartDays = useMemo(() => {
    if (!data?.daily_usage || data.daily_usage.length === 0) return [];
    return data.daily_usage.slice(-14);
  }, [data]);

  const maxChartValue = useMemo(() => {
    if (chartDays.length === 0) return 1;
    return Math.max(
      ...chartDays.map((d) => {
        if (chartMetric === "requests") return d.requests || 0;
        if (chartMetric === "tokens") return d.total_tokens || 0;
        return d.actual_cost ?? d.cost ?? 0;
      }),
      0.01
    );
  }, [chartDays, chartMetric]);

  const forecastInfo = useMemo(() => {
    const recent = (data?.daily_usage || []).slice(-7).filter((d) => (d.actual_cost ?? d.cost ?? 0) > 0);
    if (recent.length === 0) return { avgDaily: 0, daysLeft: null as number | null };
    const sum = recent.reduce((acc, d) => acc + (d.actual_cost ?? d.cost ?? 0), 0);
    const avgDaily = sum / recent.length;
    const daysLeft = avgDaily > 0 ? remaining / avgDaily : null;
    return { avgDaily, daysLeft };
  }, [data, remaining]);

  // Sorted Models & Providers
  const topModels = useMemo(() => {
    if (!data?.model_stats) return [];
    return [...data.model_stats].sort(
      (a, b) => (b.actual_cost ?? b.cost ?? 0) - (a.actual_cost ?? a.cost ?? 0)
    );
  }, [data]);

  const keyMasked = useMemo(() => {
    const trimmed = apiKey.trim();
    if (!trimmed) return "No Key";
    if (trimmed.length <= 10) return `${trimmed.slice(0, 3)}•••`;
    return `${trimmed.slice(0, 5)}•••${trimmed.slice(-4)}`;
  }, [apiKey]);

  const navTabItems = useMemo<SmoothTabItem[]>(
    () => [
      { id: "overview", title: "Обзор", icon: <TrendingUp size={13} /> },
      { id: "pricing", title: "Тарифы", icon: <Layers size={13} /> },
      { id: "monitor", title: "Монитор", icon: <Activity size={13} /> },
      { id: "analytics", title: "Аналитика", icon: <Calendar size={13} /> },
      {
        id: "models",
        title: "Модели",
        icon: <Cpu size={13} />,
        badge: topModels.length > 0 ? topModels.length : undefined,
      },
      { id: "history", title: "История", icon: <BarChart3 size={13} /> },
      { id: "settings", title: "Настройки", icon: <SlidersHorizontal size={13} /> },
    ],
    [topModels.length]
  );

  const renderChartTrack = useCallback(
    (metric: ChartMetric) => {
      if (chartDays.length === 0) {
        return <div className="empty-state">Нет данных за период</div>;
      }

      const values = chartDays.map((d) => getChartMetricValue(d, metric));
      const peak = Math.max(...values, 0.01);

      if (chartViewMode === "bars") {
        return (
          <div className={`bars-track-area metric-${metric}`}>
            {chartDays.map((d, idx) => {
              const val = values[idx];
              const heightPct = Math.max(8, Math.min(100, (val / peak) * 100));
              const isToday = idx === chartDays.length - 1;
              const isHovered = hoveredDay?.date === d.date;
              return (
                <div
                  key={d.date}
                  className={`chart-bar-col ${isHovered ? "active" : ""}`}
                  onMouseEnter={() => setHoveredDay(d)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  <div className="bar-pillar-wrap">
                    <div
                      className={`bar-pillar ${isToday ? "today" : ""}`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="bar-date-label">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        );
      }

      // Smooth Area Curve + Crosshair SVG Chart
      const svgW = 560;
      const svgH = 148;
      const padX = 12;
      const padTop = 14;
      const baseLineY = 124;
      const plotW = svgW - padX * 2;
      const plotH = baseLineY - padTop;

      const points = chartDays.map((d, idx) => {
        const x =
          chartDays.length > 1
            ? padX + (idx / (chartDays.length - 1)) * plotW
            : svgW / 2;
        const ratio = Math.max(0, Math.min(1, values[idx] / peak));
        const y = baseLineY - ratio * plotH;
        return { x, y, day: d, val: values[idx] };
      });

      const { linePath, areaPath } = buildSmoothCurvePaths(points, baseLineY);
      const strokeColor =
        metric === "cost"
          ? "#30d158"
          : metric === "requests"
            ? "#60a5fa"
            : "#e4e4e7";
      const gradId = `areaGrad-${metric}`;

      const activePoint =
        (hoveredDay ? points.find((p) => p.day.date === hoveredDay.date) : null) ||
        points[points.length - 1];
      const peakPoint = points.reduce(
        (best, cur) => (cur.val >= best.val ? cur : best),
        points[0]
      );

      // Show ~5 clean X-axis ticks evenly spaced without crowding
      const tickStep = Math.max(1, Math.floor((chartDays.length - 1) / 4));

      return (
        <div
          className="area-chart-stage"
          onMouseLeave={() => setHoveredDay(null)}
        >
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="area-chart-svg"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.34" />
                <stop offset="68%" stopColor={strokeColor} stopOpacity="0.08" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Hairline Horizontal Gridlines */}
            <line
              x1={padX}
              y1={padTop}
              x2={svgW - padX}
              y2={padTop}
              className="area-grid-line"
            />
            <line
              x1={padX}
              y1={padTop + plotH * 0.5}
              x2={svgW - padX}
              y2={padTop + plotH * 0.5}
              className="area-grid-line"
            />
            <line
              x1={padX}
              y1={baseLineY}
              x2={svgW - padX}
              y2={baseLineY}
              className="area-grid-baseline"
            />

            {/* Gradient Area Fill & Crisp Curve */}
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path
              d={linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            {/* Vertical Crosshair on Active / Today Point */}
            {activePoint && (
              <>
                <line
                  x1={activePoint.x}
                  y1={padTop}
                  x2={activePoint.x}
                  y2={baseLineY}
                  className="area-crosshair"
                />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="6"
                  fill={strokeColor}
                  fillOpacity="0.22"
                />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="3.2"
                  fill="#000000"
                  stroke={strokeColor}
                  strokeWidth="2"
                />
              </>
            )}

            {/* Subtle Peak Indicator Ring when hovering a different day */}
            {hoveredDay && peakPoint.day.date !== hoveredDay.date && (
              <circle
                cx={peakPoint.x}
                cy={peakPoint.y}
                r="2.4"
                fill="rgba(255,255,255,0.45)"
              />
            )}

            {/* Invisible Hover Hit Columns for Smooth Scrubbing */}
            {points.map((pt, idx) => {
              const colW = plotW / points.length;
              const rectX = Math.max(0, pt.x - colW / 2);
              return (
                <rect
                  key={pt.day.date}
                  x={rectX}
                  y={0}
                  width={idx === 0 || idx === points.length - 1 ? colW / 2 + padX : colW}
                  height={baseLineY}
                  fill="transparent"
                  className="area-hit-col"
                  onMouseEnter={() => setHoveredDay(pt.day)}
                />
              );
            })}
          </svg>

          <div className="area-xaxis-labels">
            {chartDays.map((d, idx) => {
              const lastIdx = chartDays.length - 1;
              const isNearLast = idx < lastIdx && lastIdx - idx < 2;
              const show = idx === 0 || idx === lastIdx || (!isNearLast && idx % tickStep === 0);
              return (
                <span
                  key={d.date}
                  className={`area-tick-label ${hoveredDay?.date === d.date ? "active" : ""}`}
                >
                  {show ? d.date.slice(5) : ""}
                </span>
              );
            })}
          </div>
        </div>
      );
    },
    [chartDays, chartViewMode, hoveredDay]
  );

  const chartSwipeItems = useMemo<SmoothTabItem[]>(
    () => [
      { id: "cost", title: "Расход $", content: renderChartTrack("cost") },
      { id: "requests", title: "Запросы", content: renderChartTrack("requests") },
      { id: "tokens", title: "Токены", content: renderChartTrack("tokens") },
    ],
    [renderChartTrack]
  );

  const availableProviders = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of topModels) {
      const p = detectProvider(m.model);
      if (!map.has(p.id)) map.set(p.id, p.label);
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [topModels]);

  const filteredModels = useMemo(() => {
    return topModels.filter((m) => {
      const matchesSearch = m.model.toLowerCase().includes(modelSearch.trim().toLowerCase());
      const matchesProvider =
        providerFilter === "all" || detectProvider(m.model).id === providerFilter;
      return matchesSearch && matchesProvider;
    });
  }, [topModels, modelSearch, providerFilter]);

  const ringColor = percent > 30 ? "var(--apple-green)" : percent > 10 ? "var(--apple-orange)" : "var(--apple-red)";

  // ========================================================
  // 1. Dynamic Island Mode Rendering
  // ========================================================
  if (isIslandMode) {
    return (
      <div className="dynamic-island-wrapper" data-tauri-drag-region>
        <div className={`dynamic-island-capsule ${isIslandExpanded ? "expanded" : ""}`}>
          <div className="island-main-bar" data-tauri-drag-region>
            <div className="island-ring-box" data-tauri-drag-region>
              <svg viewBox="0 0 36 36" className="island-ring-svg">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="3.2"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="3.4"
                  strokeDasharray={`${percent * 0.88} 100`}
                  strokeLinecap="round"
                  transform="rotate(-90 18 18)"
                  style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}
                />
              </svg>
              <span className="island-ring-label">{Math.round(percent)}%</span>
            </div>

            <div className="island-info" data-tauri-drag-region>
              <div className="island-quota-line" data-tauri-drag-region>
                <AnimatedNumber value={remaining} prefix="$" decimals={2} className="island-quota-val" />
                <span className="island-quota-limit">/ ${limit.toFixed(0)}</span>
              </div>
              <div className="island-sub-line" data-tauri-drag-region>
                <span className="island-today-pill">
                  Сегодня: <AnimatedNumber value={todayCost} prefix="$" decimals={2} /> ({todayReq} зап.)
                </span>
              </div>
            </div>

            <div className="island-controls">
              <button
                className={`island-btn refresh-btn ${loading ? "spinning" : ""}`}
                onClick={() => {
                  appleAudio.playTap();
                  loadData();
                }}
                title="Обновить"
              >
                <AnimatedRefreshCw size={12} spinning={loading} />
              </button>
              <button
                className="island-btn expand-btn"
                onClick={toggleIslandExpanded}
                title={isIslandExpanded ? "Свернуть детали" : "Развернуть детали"}
              >
                {isIslandExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              <button
                className="island-btn restore-btn"
                onClick={toggleIslandMode}
                title="Развернуть в полное окно"
              >
                <Maximize2 size={12} />
              </button>
            </div>
          </div>

          {isIslandExpanded && (
            <div className="island-drawer">
              <div className="island-drawer-row">
                <div className="island-drawer-metric">
                  <span className="label">Всего расход</span>
                  <AnimatedNumber value={totalCost} prefix="$" decimals={2} className="val" />
                </div>
                <div className="island-drawer-metric">
                  <span className="label">Экономия кэша</span>
                  <span className="val" style={{ color: "var(--apple-green)" }}>
                    {cacheHitPct.toFixed(0)}%
                  </span>
                </div>
                <div className="island-drawer-metric">
                  <span className="label">RPM / TPM</span>
                  <span className="val">{rpm} / {formatNumber(tpm)}</span>
                </div>
              </div>

              {chartDays.length > 1 && (() => {
                const miniDays = chartDays.slice(-7);
                const miniPeak = Math.max(...miniDays.map((d) => d.actual_cost ?? d.cost ?? 0), 0.01);
                const pts = miniDays.map((d, idx) => ({
                  x: (idx / (miniDays.length - 1)) * 220,
                  y: 26 - ((d.actual_cost ?? d.cost ?? 0) / miniPeak) * 20,
                }));
                const { linePath, areaPath } = buildSmoothCurvePaths(pts, 28);
                return (
                  <div className="island-spark-row">
                    <div className="island-spark-meta">
                      <span>Тренд 7д</span>
                      <strong>
                        {forecastInfo.daysLeft !== null
                          ? `~${forecastInfo.daysLeft < 1 ? "< 1" : Math.round(forecastInfo.daysLeft)} дн.`
                          : `$${forecastInfo.avgDaily.toFixed(1)}/д`}
                      </strong>
                    </div>
                    <svg viewBox="0 0 220 30" className="island-spark-svg" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="islandSparkGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={ringColor} stopOpacity="0.32" />
                          <stop offset="100%" stopColor={ringColor} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={areaPath} fill="url(#islandSparkGrad)" />
                      <path d={linePath} fill="none" stroke={ringColor} strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </div>
                );
              })()}

              {topModels.length > 0 && (
                <div className="island-top-models">
                  {topModels.slice(0, 2).map((m) => (
                    <div key={m.model} className="island-model-pill">
                      <ModelLogo model={m.model} size={12} withBadge={false} />
                      <span className="model-name">{m.model}</span>
                      <span className="model-cost">${(m.actual_cost ?? m.cost ?? 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========================================================
  // 1.5. Boot / Welcome Sign-In Gate (No Personal Keys Embedded)
  // ========================================================
  if (!keyLoaded) {
    return (
      <div className={`apple-window backdrop-${backdropMode} ${isWindowMaximized ? "maximized" : ""}`}>
        <header className="mac-titlebar" data-tauri-drag-region onDoubleClick={handleTitlebarDoubleClick}>
          <div className="traffic-lights" onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className="light close" onClick={() => invoke("window_close")}><span>×</span></button>
            <button type="button" className="light minimize" onClick={() => invoke("window_minimize")}><span>−</span></button>
            <button type="button" className="light zoom" onClick={() => void handleToggleMaximize()}><span>+</span></button>
          </div>
          <div className="titlebar-center" data-tauri-drag-region>
            <span className="app-title-text">TrueSOTA</span>
            <span className="app-badge-pro">PRO</span>
          </div>
          <div className="traffic-lights" style={{ opacity: 0, pointerEvents: "none" }} />
        </header>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className={`apple-window backdrop-${backdropMode} ${isWindowMaximized ? "maximized" : ""}`}>
        <header
          className="mac-titlebar welcome-titlebar"
          data-tauri-drag-region
          onDoubleClick={handleTitlebarDoubleClick}
        >
          <div className="traffic-lights" onMouseDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="light close"
              title="Закрыть окно"
              onClick={() => invoke("window_close")}
            >
              <span>×</span>
            </button>
            <button
              type="button"
              className="light minimize"
              title="Свернуть"
              onClick={() => invoke("window_minimize")}
            >
              <span>−</span>
            </button>
            <button
              type="button"
              className="light zoom"
              title={isWindowMaximized ? "Восстановить окно" : "На весь экран (1920×1080)"}
              onClick={() => void handleToggleMaximize()}
            >
              <span>+</span>
            </button>
          </div>

          <div className="titlebar-center" data-tauri-drag-region>
            <div className="app-badge-title" data-tauri-drag-region>
              <span className="app-title-text" data-tauri-drag-region>TrueSOTA</span>
              <span className="app-badge-pro" data-tauri-drag-region>PRO</span>
            </div>
            <div className="status-pill" data-tauri-drag-region>
              <span className="status-label">Добро пожаловать</span>
            </div>
          </div>

          <div className="titlebar-actions" onMouseDown={(e) => e.stopPropagation()}>
            <div className="backdrop-segmented">
              {(["mica", "acrylic", "oled"] as BackdropMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`backdrop-chip ${backdropMode === mode ? "active" : ""}`}
                  onClick={() => handleSelectBackdrop(mode)}
                >
                  {mode === "mica" ? "Mica" : mode === "acrylic" ? "Acrylic" : "OLED"}
                </button>
              ))}
            </div>
          </div>
        </header>

        <WelcomeAuth onAuthenticated={handleAuthenticated} />
      </div>
    );
  }

  // ========================================================
  // 2. Full macOS Apple Dark Window Rendering
  // ========================================================
  return (
    <div className={`apple-window backdrop-${backdropMode} ${isWindowMaximized ? "maximized" : ""}`}>
      {/* macOS Unified Frameless Titlebar */}
      <header
        className="mac-titlebar"
        data-tauri-drag-region
        onDoubleClick={handleTitlebarDoubleClick}
      >
        <div
          className="traffic-lights"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="light close"
            title={nativePrefs.close_to_tray ? "Свернуть в системный трей" : "Закрыть программу"}
            onClick={() => invoke("window_close")}
          >
            <span>×</span>
          </button>
          <button
            type="button"
            className="light minimize"
            title="Свернуть"
            onClick={() => invoke("window_minimize")}
          >
            <span>−</span>
          </button>
          <button
            type="button"
            className="light zoom"
            title={isWindowMaximized ? "Восстановить окно" : "На весь экран (1920×1080)"}
            onClick={() => void handleToggleMaximize()}
          >
            <span>+</span>
          </button>
        </div>

        <div className="titlebar-center" data-tauri-drag-region>
          <div className="app-badge-title" data-tauri-drag-region>
            <span className="app-title-text" data-tauri-drag-region>TrueSOTA</span>
            <span className="app-badge-pro" data-tauri-drag-region>PRO</span>
          </div>
          <div className="status-pill" data-tauri-drag-region>
            <span className="status-dot-pulse" />
            <span className="status-label">{data?.status || "active"}</span>
          </div>
        </div>

        <div
          className="titlebar-actions"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {updateInfo?.has_update && (
            <button
              type="button"
              className="update-title-pill"
              onClick={handleOpenUpdateRelease}
              title={`Доступно обновление ${updateInfo.latest_version}`}
            >
              <ArrowUpCircle size={13} />
              <span>{updateInfo.latest_version}</span>
            </button>
          )}

          <button
            type="button"
            className="spotlight-trigger-btn"
            onClick={() => {
              appleAudio.playTap();
              setCommandPaletteOpen(true);
            }}
            title="Быстрые команды (Ctrl+K)"
          >
            <Command size={12} />
            <span>K</span>
          </button>

          <button
            type="button"
            className="mac-icon-btn titlebar-desktop-only"
            onClick={() => {
              appleAudio.playTap();
              setShareModalOpen(true);
            }}
            title="Создать Apple Share Card / Экспорт отчёта"
          >
            <Share2 size={14} />
          </button>

          <button
            type="button"
            className="dynamic-island-toggle-btn"
            onClick={toggleIslandMode}
            title="Переключить в плавающий мини-виджет Dynamic Island"
          >
            <AnimatedSparkles size={13} />
            <span>Островок</span>
          </button>

          <button
            type="button"
            className={`sound-toggle-btn titlebar-desktop-only ${!soundEnabled ? "muted" : ""}`}
            onClick={toggleSound}
            title={soundEnabled ? "Звуки включены" : "Звуки выключены"}
          >
            {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>

          <button
            type="button"
            className={`mac-icon-btn titlebar-desktop-only ${copied ? "success" : ""}`}
            onClick={handleCopyReport}
            title="Скопировать сводку"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>

          <button
            type="button"
            className="mac-icon-btn"
            onClick={() => {
              appleAudio.playTap();
              loadData();
            }}
            disabled={loading}
            title="Обновить данные"
          >
            <AnimatedRefreshCw size={14} spinning={loading} />
          </button>

          <ProfileDropdown
            keyMasked={keyMasked}
            statusText={data?.status || "active"}
            isHealthy={!error && (data?.isValid ?? true)}
            quotaPercent={percent}
            quotaLeftText={`$${remaining.toFixed(2)}`}
            backdropMode={backdropMode}
            onSelectBackdrop={handleSelectBackdrop}
            appVersion={updateInfo?.current_version || "1.3.0"}
            updateAvailableVersion={
              updateInfo?.has_update ? updateInfo.latest_version : null
            }
            dpapiActive={keyStorage.protected}
            onOpenSettings={() => handleTabChange("settings")}
            onOpenShareCard={() => setShareModalOpen(true)}
            onCheckUpdates={() => {
              handleTabChange("settings");
              void handleCheckUpdates(false);
            }}
            onHideToTray={() => void invoke("window_hide_to_tray")}
            onCopyKey={() => {
              if (apiKey.trim()) {
                void navigator.clipboard.writeText(apiKey.trim());
              }
            }}
            onSignOut={handleSignOut}
          />
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="segmented-wrapper">
        <SmoothTab
          barOnly
          variant="nav"
          label="Разделы TrueSOTA Monitor"
          items={navTabItems}
          value={activeTab}
          onChange={(tabId) => handleTabChange(tabId as AppTab)}
        />
      </div>

      {/* Main Content Area */}
      <main className="mac-viewport" ref={viewportRef}>
        {updateInfo?.has_update && !updateDismissed && (
          <div className="toast-banner update">
            <ArrowUpCircle size={15} />
            <span style={{ flex: 1 }}>
              Доступна новая версия <strong>{updateInfo.latest_version}</strong> (у вас{" "}
              <code>v{updateInfo.current_version}</code>)
            </span>
            <button
              type="button"
              className="update-banner-btn"
              onClick={handleOpenUpdateRelease}
            >
              <AnimatedDownload size={12} />
              <span>Скачать</span>
            </button>
            <button
              type="button"
              className="update-dismiss-btn"
              onClick={() => setUpdateDismissed(true)}
            >
              Скрыть
            </button>
          </div>
        )}

        {error && (
          <div className="toast-banner error">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (() => {
          const healthState = percent < 15 ? "low" : percent < 40 ? "med" : "good";
          const usedPct = Math.min(100, Math.max(0, 100 - percent));
          const todayVsAvgPct =
            forecastInfo.avgDaily > 0.05
              ? Math.round(((todayCost - forecastInfo.avgDaily) / forecastInfo.avgDaily) * 100)
              : null;

          return (
          <div className="bento-container">
            {/* 3-Column Bento Hero Grid */}
            <div className="bento-hero-grid">
              {/* Quota Ring Card */}
              <div className={`bento-card hero-quota-card health-${healthState}`}>
                <div className="card-subhead">
                  <span>Квота пакета</span>
                  <div className="hero-subhead-badges">
                    {forecastInfo.daysLeft !== null && (
                      <span className="forecast-micro-pill">
                        <Hourglass size={10} />
                        <span>
                          {forecastInfo.daysLeft < 1
                            ? "< 1 дн."
                            : `~${Math.round(forecastInfo.daysLeft)} дн.`}
                        </span>
                      </span>
                    )}
                    <span className="mode-pill">{data?.mode || "quota"}</span>
                  </div>
                </div>
                <div className="ring-content-row">
                  <div className="gauge-ring-container">
                    <svg viewBox="0 0 100 100" className="gauge-svg" width="108" height="108">
                      <defs>
                        <linearGradient id="gaugeGoodGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#ffffff" />
                          <stop offset="100%" stopColor="#30d158" />
                        </linearGradient>
                        <linearGradient id="gaugeMedGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#ffd60a" />
                          <stop offset="100%" stopColor="#ff9f0a" />
                        </linearGradient>
                        <linearGradient id="gaugeLowGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#ff9f0a" />
                          <stop offset="100%" stopColor="#ff453a" />
                        </linearGradient>
                      </defs>
                      <circle cx="50" cy="50" r="40" className="gauge-bg" strokeWidth="8" />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        className={`gauge-fill ${healthState}`}
                        stroke={
                          healthState === "low"
                            ? "url(#gaugeLowGrad)"
                            : healthState === "med"
                              ? "url(#gaugeMedGrad)"
                              : "url(#gaugeGoodGrad)"
                        }
                        strokeWidth="8"
                        strokeDasharray="251.32"
                        strokeDashoffset={251.32 * (1 - percent / 100)}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}
                      />
                    </svg>
                    <div className="gauge-inner-text">
                      <AnimatedNumber value={percent} decimals={1} suffix="%" className="gauge-pct" />
                      <span className="gauge-pct-sub">остаток</span>
                    </div>
                  </div>

                  <div className="hero-money-details">
                    <AnimatedNumber
                      value={remaining}
                      prefix="$"
                      decimals={2}
                      splitDecimals
                      className="hero-big-money"
                    />
                    <div className="hero-quota-progress-wrap">
                      <div className="hero-quota-bar">
                        <div
                          className={`hero-quota-bar-fill ${healthState}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="hero-quota-used-pct">{usedPct.toFixed(0)}% расх.</span>
                    </div>
                    <div className="hero-meta-list">
                      <div className="meta-item">
                        <span className="dot blue" />
                        <span className="meta-label">Лимит:</span>
                        <span className="meta-val">${limit.toFixed(2)}</span>
                      </div>
                      <div className="meta-item">
                        <span className="dot gray" />
                        <span className="meta-label">Потрачено:</span>
                        <span className="meta-val">${used.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Today Card */}
              <div className="bento-card metric-card">
                <div className="card-subhead">
                  <span>Сегодня</span>
                  <div className="metric-head-right">
                    {todayVsAvgPct !== null && (
                      <span className={`delta-micro-pill ${todayVsAvgPct <= 0 ? "cool" : "warm"}`}>
                        {todayVsAvgPct > 0 ? `+${todayVsAvgPct}%` : `${todayVsAvgPct}%`} к 7д
                      </span>
                    )}
                    <Clock size={13} className="subhead-icon green" />
                  </div>
                </div>
                <div className="metric-cost-row">
                  <AnimatedNumber
                    value={todayCost}
                    prefix="$"
                    decimals={2}
                    splitDecimals
                    className="metric-large-text"
                  />
                  {todaySavingsPct > 0 && (
                    <>
                      <span className="strike-cost">${todayNominal.toFixed(2)}</span>
                      <span className="savings-tag">-{todaySavingsPct}%</span>
                    </>
                  )}
                </div>
                <div className="metric-specs-list">
                  <div className="spec-row">
                    <span>Запросы</span>
                    <strong><AnimatedNumber value={todayReq} decimals={0} /></strong>
                  </div>
                  <div className="spec-row">
                    <span>Кэш-токены</span>
                    <strong>{formatNumber(todayCacheRead)} / {formatNumber(todayTokens)}</strong>
                  </div>
                  <div className="spec-row sub">
                    <span>RPM / TPM</span>
                    <span>{rpm} / {formatNumber(tpm)}</span>
                  </div>
                </div>
              </div>

              {/* Total Card */}
              <div className="bento-card metric-card">
                <div className="card-subhead">
                  <span>Всего</span>
                  <Database size={13} className="subhead-icon blue" />
                </div>
                <div className="metric-cost-row">
                  <AnimatedNumber
                    value={totalCost}
                    prefix="$"
                    decimals={2}
                    splitDecimals
                    className="metric-large-text"
                  />
                  {totalSavedPct >= 1 && (
                    <span className="savings-tag">-{Math.round(totalSavedPct)}%</span>
                  )}
                </div>
                <div className="metric-specs-list">
                  <div className="spec-row">
                    <span>Запросы</span>
                    <strong><AnimatedNumber value={totalReq} decimals={0} /></strong>
                  </div>
                  <div className="spec-row">
                    <span>In / Out</span>
                    <strong>{formatNumber(totalInputTokens)} / {formatNumber(totalOutputTokens)}</strong>
                  </div>
                  <div className="spec-row sub">
                    <span>Всего токенов</span>
                    <strong>{formatNumber(totalTokens)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Unified 4-Column Telemetry Dock */}
            <div className="insights-strip telemetry-dock">
              <div className="insight-pill-card">
                <div className="insight-icon-wrap green">
                  <Layers size={15} />
                </div>
                <div className="insight-text-col">
                  <span className="insight-label">Кэш-хит</span>
                  <span className="insight-val">
                    <AnimatedNumber value={cacheHitPct} decimals={1} suffix="%" />
                  </span>
                  <span className="insight-sub">{formatNumber(totalCacheRead)} из кэша</span>
                </div>
              </div>

              <div className="insight-pill-card">
                <div className="insight-icon-wrap blue">
                  <PiggyBank size={15} />
                </div>
                <div className="insight-text-col">
                  <span className="insight-label">Экономия</span>
                  <span className="insight-val">
                    <AnimatedNumber value={totalSaved} prefix="$" decimals={2} />
                  </span>
                  <span className="insight-sub">база ${totalNominal.toFixed(0)}</span>
                </div>
              </div>

              <div className="insight-pill-card">
                <div className="insight-icon-wrap orange">
                  <Zap size={15} />
                </div>
                <div className="insight-text-col">
                  <span className="insight-label">Ср. отклик</span>
                  <span className="insight-val">
                    {avgDurationSec > 0 ? `${avgDurationSec.toFixed(1)}с` : "—"}
                  </span>
                  <span className="insight-sub">~${avgCostPerReq.toFixed(3)} / зап.</span>
                </div>
              </div>

              <div className="insight-pill-card">
                <div className="insight-icon-wrap purple">
                  <Hourglass size={15} />
                </div>
                <div className="insight-text-col">
                  <span className="insight-label">Прогноз</span>
                  <span className="insight-val">
                    {forecastInfo.daysLeft !== null
                      ? `~${forecastInfo.daysLeft < 1 ? "< 1" : Math.round(forecastInfo.daysLeft)} дн.`
                      : "—"}
                  </span>
                  <span className="insight-sub">
                    ${forecastInfo.avgDaily.toFixed(1)}/день (7д)
                  </span>
                </div>
              </div>
            </div>

            {/* Widescreen 2-Column Bottom Bento: 14-Day Dynamics + Top Models */}
            <div className="overview-bottom-grid">
              {/* 14-Day Interactive Swipe Spend Trend Chart */}
              <div className="bento-card chart-card">
                <SmoothTab
                  variant="compact"
                  label="Метрика графика за 14 дней"
                  items={chartSwipeItems}
                  value={chartMetric}
                  onChange={(id) => {
                    appleAudio.playTap();
                    setChartMetric(id as ChartMetric);
                  }}
                  headerLeft={
                    <span className="card-subhead">Динамика (14 дней)</span>
                  }
                  headerRight={
                    <div className="chart-header-controls">
                      <div className="chart-view-toggle" role="group" aria-label="Вид графика">
                        <button
                          type="button"
                          className={`chart-view-btn ${chartViewMode === "area" ? "active" : ""}`}
                          onClick={() => handleSelectChartViewMode("area")}
                          title="Плавный график"
                        >
                          <TrendingUp size={11} />
                        </button>
                        <button
                          type="button"
                          className={`chart-view-btn ${chartViewMode === "bars" ? "active" : ""}`}
                          onClick={() => handleSelectChartViewMode("bars")}
                          title="Столбцы"
                        >
                          <BarChart3 size={11} />
                        </button>
                      </div>
                      <div className="chart-hover-pill">
                        {hoveredDay ? (
                          <span>
                            {hoveredDay.date.slice(5)}:{" "}
                            <strong>
                              $
                              {(hoveredDay.actual_cost ?? hoveredDay.cost ?? 0).toFixed(2)}
                            </strong>{" "}
                            • {hoveredDay.requests} зап.
                          </span>
                        ) : (
                          <span>
                            Пик:{" "}
                            <strong>
                              {chartMetric === "cost"
                                ? `$${maxChartValue.toFixed(2)}`
                                : chartMetric === "requests"
                                  ? `${Math.round(maxChartValue)} зап.`
                                  : formatNumber(maxChartValue)}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>
                  }
                />
              </div>

            {/* Top Models Leaderboard Card */}
            {topModels.length > 0 && (
              <div className="bento-card preview-models-card">
                <div className="card-subhead-row">
                  <div className="models-head-title">
                    <span className="card-subhead">Топ нейросетей</span>
                    <span className="models-copy-hint">нажмите чтобы скопировать ID</span>
                  </div>
                  <button className="link-btn" onClick={() => handleTabChange("models")}>
                    <span>Все модели ({topModels.length})</span>
                    <ChevronRight size={12} />
                  </button>
                </div>

                <div className="models-mini-list">
                  {topModels.slice(0, 6).map((item, idx) => {
                    const actual = item.actual_cost ?? item.cost ?? 0;
                    const nominal = item.cost || actual;
                    const sharePct = totalCost > 0 ? (actual / totalCost) * 100 : 0;
                    const provider = detectProvider(item.model);
                    const isCopied = copiedModelId === item.model;
                    return (
                      <button
                        type="button"
                        key={item.model}
                        className={`mini-model-row-logo ${idx === 0 ? "rank-top" : ""} ${isCopied ? "is-copied" : ""}`}
                        onClick={() => handleCopyModelId(item.model)}
                        title={`Скопировать ID модели: ${item.model}`}
                      >
                        <div className="model-identity-cell">
                          <span className={`model-rank-num ${idx === 0 ? "top" : ""}`}>
                            {idx + 1}
                          </span>
                          <ModelLogo model={item.model} size={15} withBadge={true} />
                          <div className="model-identity-text">
                            <span className="mini-model-name">
                              {isCopied ? "✓ Скопировано в буфер" : item.model}
                            </span>
                            <span className="model-provider-sub">
                              {provider.label} • {formatNumber(item.total_tokens)} ток.
                            </span>
                          </div>
                        </div>

                        <div className="mini-model-bar-cell">
                          <div className="mini-model-bar-wrap">
                            <div
                              className="mini-model-bar"
                              style={{
                                width: `${Math.min(100, Math.max(6, sharePct))}%`,
                                backgroundColor: provider.color,
                              }}
                            />
                          </div>
                          <span className="mini-model-share">{Math.round(sharePct)}%</span>
                        </div>

                        <div className="mini-model-stats">
                          <strong>${actual.toFixed(2)}</strong>
                          {nominal > actual * 1.05 && (
                            <span className="strike-cost">${nominal.toFixed(0)}</span>
                          )}
                          <span className="mini-req-badge">{item.requests}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          </div>
          );
        })()}

        {/* TAB 2: MODELS */}
        {activeTab === "models" && (
          <div className="view-container">
            <ModelDonutChart stats={topModels} />

            {/* Search & Provider Filter Toolbar */}
            <div className="models-toolbar">
              <div className="models-search-wrap">
                <Search size={14} className="models-search-icon" />
                <input
                  type="text"
                  className="models-search-input"
                  placeholder="Поиск нейросети..."
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                />
              </div>

              <div className="provider-filter-pills">
                <button
                  className={`provider-filter-btn ${providerFilter === "all" ? "active" : ""}`}
                  onClick={() => {
                    appleAudio.playTap();
                    setProviderFilter("all");
                  }}
                >
                  Все ({topModels.length})
                </button>
                {availableProviders.map((prov) => (
                  <button
                    key={prov.id}
                    className={`provider-filter-btn ${providerFilter === prov.id ? "active" : ""}`}
                    onClick={() => {
                      appleAudio.playTap();
                      setProviderFilter(prov.id);
                    }}
                  >
                    {prov.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bento-card table-wrapper-card">
              <div className="mac-table-header models-cols">
                <span>Нейросеть</span>
                <span>Вызовы</span>
                <span style={{ textAlign: "right" }}>Токены (Кэш)</span>
                <span style={{ textAlign: "right" }}>Факт / База</span>
              </div>
              <div className="mac-table-body">
                {filteredModels.map((item) => {
                  const actual = item.actual_cost ?? item.cost ?? 0;
                  const nominal = item.cost || actual;
                  const provider = detectProvider(item.model);
                  const modelCachePct =
                    item.total_tokens > 0 && item.cache_read_tokens
                      ? Math.round((item.cache_read_tokens / item.total_tokens) * 100)
                      : 0;
                  const discPct =
                    nominal > actual && nominal > 0
                      ? Math.round(((nominal - actual) / nominal) * 100)
                      : 0;

                  return (
                    <div key={item.model} className="mac-table-row models-cols">
                      <div className="model-identity-cell">
                        <ModelLogo model={item.model} size={15} withBadge={true} />
                        <div className="model-identity-text">
                          <span className="mini-model-name" title={item.model}>
                            {item.model}
                          </span>
                          <span className="model-provider-sub">{provider.label}</span>
                        </div>
                      </div>

                      <div className="col-cell reqs">
                        <div className="table-bar-track">
                          <div
                            className="table-bar-fill"
                            style={{
                              width: `${Math.min(100, (item.requests / (totalReq || 1)) * 100)}%`,
                              backgroundColor: provider.color,
                            }}
                          />
                        </div>
                        <span className="req-count-label">{item.requests.toLocaleString()}</span>
                      </div>

                      <div className="cost-dual-cell">
                        <span className="font-mono">{formatNumber(item.total_tokens)}</span>
                        <span className="token-breakdown-sub">
                          In {formatNumber(item.input_tokens)} • Cache {modelCachePct}%
                        </span>
                      </div>

                      <div className="cost-dual-cell">
                        <span className="font-mono font-semibold text-green">
                          ${actual.toFixed(3)}
                        </span>
                        {discPct >= 5 && (
                          <div className="cost-dual-sub">
                            <span className="strike-cost">${nominal.toFixed(2)}</span>
                            <span className="savings-tag">-{discPct}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredModels.length === 0 && (
                  <div className="empty-state">Нет моделей по заданному фильтру</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: HISTORY */}
        {activeTab === "history" && (
          <div className="view-container">
            <div className="bento-card table-wrapper-card">
              <div className="mac-table-header history-cols">
                <span>Дата</span>
                <span>Запросы</span>
                <span style={{ textAlign: "right" }}>Токены</span>
                <span style={{ textAlign: "right" }}>Кэш</span>
                <span style={{ textAlign: "right" }}>Расход</span>
              </div>
              <div className="mac-table-body">
                {(data?.daily_usage || []).slice().reverse().map((d) => {
                  const actual = d.actual_cost ?? d.cost ?? 0;
                  const nominal = d.cost || actual;
                  const cacheHit =
                    d.total_tokens > 0 && d.cache_read_tokens
                      ? Math.round((d.cache_read_tokens / d.total_tokens) * 100)
                      : 0;
                  return (
                    <div key={d.date} className="mac-table-row history-cols">
                      <span className="font-mono">{d.date}</span>
                      <span className="col-cell font-mono">{d.requests.toLocaleString()}</span>
                      <span className="col-cell tokens font-mono text-dim">{formatNumber(d.total_tokens)}</span>
                      <span className="col-cell tokens font-mono" style={{ color: "var(--apple-cyan)" }}>
                        {cacheHit}%
                      </span>
                      <div className="cost-dual-cell">
                        <span className="font-mono font-semibold" style={{ color: "var(--apple-orange)" }}>
                          ${actual.toFixed(2)}
                        </span>
                        {nominal > actual * 1.05 && (
                          <span className="strike-cost">${nominal.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB: PUBLIC PRICING & GROUPS */}
        {activeTab === "pricing" && (
          <PricingCatalog
            apiKey={apiKey}
            onOpenMonitorTab={() => handleTabChange("monitor")}
          />
        )}

        {/* TAB: LIVE EMBEDDED CHANNEL MONITOR */}
        {activeTab === "monitor" && (
          <MonitorView
            apiKey={apiKey}
            isVisible={
              activeTab === "monitor" &&
              !commandPaletteOpen &&
              !shareModalOpen &&
              !isIslandMode
            }
            onSyncTrigger={monitorSyncTick + (error ? 1 : 0)}
            onPingResult={handleGatewayStatus}
          />
        )}

        {/* TAB: HEATMAP & CACHE PROFILER */}
        {activeTab === "analytics" && (
          <ActivityHeatmap
            dailyUsage={data?.daily_usage || []}
            modelStats={data?.model_stats || []}
          />
        )}

        {/* TAB 4: SETTINGS */}
        {activeTab === "settings" && (
          <div className="settings-view">
            <div className="settings-columns">
              <div className="settings-col">
                <Accordion multiple defaultOpen={["api", "tray"]}>
                  <AccordionItem value="api">
                    <AccordionTrigger
                      icon={<SlidersHorizontal size={14} />}
                      meta={keyMasked}
                    >
                      Конфигурация API и интерфейса
                    </AccordionTrigger>
                    <AccordionPanel>
                      <div className="setting-row">
                        <div className="setting-label-col">
                          <span className="setting-name">TrueSOTA API Key</span>
                          <span className="setting-description">
                            Токен доступа к API •{" "}
                            <strong style={{ color: "var(--apple-green)" }}>
                              {keyStorage.method}
                            </strong>
                          </span>
                        </div>
                        <div className="setting-input-wrap">
                          <div className="mac-input-box">
                            <input
                              type={showKey ? "text" : "password"}
                              value={keyInput}
                              onChange={(e) => setKeyInput(e.target.value)}
                              placeholder="Вставьте ваш API ключ..."
                              className="mac-key-input"
                            />
                            <button
                              type="button"
                              className="key-eye-btn"
                              onClick={() => setShowKey(!showKey)}
                            >
                              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                          <SpecularButton
                            type="button"
                            size="sm"
                            radius={9}
                            tint="#ffffff"
                            tintOpacity={0.16}
                            lineColor="#ffffff"
                            baseColor="#141417"
                            onClick={handleSaveKey}
                          >
                            Сохранить
                          </SpecularButton>
                          <button
                            type="button"
                            className="mac-action-btn signout-btn"
                            onClick={handleSignOut}
                            title="Удалить ключ и выйти на экран приветствия"
                          >
                            <LogOut size={13} />
                            <span>Выйти</span>
                          </button>
                        </div>
                      </div>

                      <div className="info-divider" style={{ margin: "12px 0" }} />

                      <div className="setting-row comet-setting-row">
                        <div className="setting-label-col">
                          <span className="setting-name">
                            Интервал автообновления (CometDial)
                          </span>
                          <span className="setting-description">
                            Покрутите шкалу или выберите пресет • Сейчас:{" "}
                            <strong>
                              {autoRefreshInterval <= 0
                                ? "Выключено"
                                : `${Math.round(autoRefreshInterval / 1000)} сек`}
                            </strong>
                          </span>
                          <div className="backdrop-segmented" style={{ marginTop: "8px" }}>
                            {[
                              { ms: 0, label: "Выкл" },
                              { ms: 30000, label: "30с" },
                              { ms: 60000, label: "60с" },
                              { ms: 180000, label: "3м" },
                            ].map((p) => (
                              <button
                                key={p.ms}
                                type="button"
                                className={`backdrop-chip ${autoRefreshInterval === p.ms ? "active" : ""}`}
                                onClick={() => {
                                  appleAudio.playTap();
                                  setAutoRefreshInterval(p.ms);
                                }}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="comet-dial-wrap">
                          <CometDial
                            value={Math.round(autoRefreshInterval / 1000)}
                            min={0}
                            max={300}
                            step={15}
                            unit="с"
                            size={112}
                            thickness={9}
                            accent="#ffffff"
                            ink="#ffffff"
                            onChange={(sec) => setAutoRefreshInterval(sec * 1000)}
                            onChangeEnd={() => appleAudio.playTap()}
                          />
                        </div>
                      </div>

                      <div className="info-divider" style={{ margin: "12px 0" }} />

                      <div className="setting-row">
                        <div className="setting-label-col">
                          <span className="setting-name">Звуковые эффекты интерфейса</span>
                          <span className="setting-description">
                            Мягкие щелчки и звон успешного обновления
                          </span>
                        </div>
                        <button
                          type="button"
                          className={`mac-action-btn ${soundEnabled ? "copied" : ""}`}
                          onClick={toggleSound}
                        >
                          {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                          <span>{soundEnabled ? "Включены" : "Выключены"}</span>
                        </button>
                      </div>
                    </AccordionPanel>
                  </AccordionItem>

                  <AccordionItem value="tray">
                    <AccordionTrigger
                      icon={<AnimatedBell size={14} active={gatewayAlertEnabled} />}
                      meta={nativePrefs.autostart ? "Автозапуск: Вкл" : "В трее"}
                    >
                      Системный трей, автозапуск и алерты
                    </AccordionTrigger>
                    <AccordionPanel>
                      <div className="setting-row">
                        <div className="setting-label-col">
                          <span className="setting-name">Запускать вместе с Windows</span>
                          <span className="setting-description">
                            Тихий старт в системном трее при входе в Windows
                          </span>
                        </div>
                        <button
                          type="button"
                          className={`mac-action-btn ${nativePrefs.autostart ? "copied" : ""}`}
                          onClick={handleToggleAutostart}
                        >
                          <Power size={13} />
                          <span>{nativePrefs.autostart ? "Включён" : "Выключен"}</span>
                        </button>
                      </div>

                      <div className="info-divider" style={{ margin: "12px 0" }} />

                      <div className="setting-row">
                        <div className="setting-label-col">
                          <span className="setting-name">
                            Сворачивать в трей при закрытии (×)
                          </span>
                          <span className="setting-description">
                            Мониторинг и баланс остаются в трее около часов Windows
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            type="button"
                            className={`mac-action-btn ${nativePrefs.close_to_tray ? "copied" : ""}`}
                            onClick={handleToggleCloseToTray}
                          >
                            <span>
                              {nativePrefs.close_to_tray ? "Включено" : "Выключено"}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="mac-action-btn"
                            onClick={() => void invoke("window_hide_to_tray")}
                            title="Свернуть окно в трей прямо сейчас"
                          >
                            <span>В трей</span>
                          </button>
                          <button
                            type="button"
                            className="mac-action-btn signout-btn"
                            onClick={() => void invoke("window_quit")}
                            title="Полностью закрыть программу"
                          >
                            <Power size={13} />
                            <span>Выйти</span>
                          </button>
                        </div>
                      </div>

                      <div className="info-divider" style={{ margin: "12px 0" }} />

                      <div className="setting-row">
                        <div className="setting-label-col">
                          <span className="setting-name">
                            Уведомление при низком остатке квоты
                          </span>
                          <span className="setting-description">
                            Windows-алерт при падении остатка ниже выбранного порога
                          </span>
                        </div>
                        <div className="backdrop-segmented">
                          {[
                            { pct: 0, label: "Выкл" },
                            { pct: 25, label: "< 25%" },
                            { pct: 15, label: "< 15%" },
                            { pct: 10, label: "< 10%" },
                            { pct: 5, label: "< 5%" },
                          ].map((opt) => (
                            <button
                              key={opt.pct}
                              type="button"
                              className={`backdrop-chip ${alertThresholdPct === opt.pct ? "active" : ""}`}
                              onClick={() => handleSelectAlertThreshold(opt.pct)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="info-divider" style={{ margin: "12px 0" }} />

                      <div className="setting-row">
                        <div className="setting-label-col">
                          <span className="setting-name">
                            Алерт при сбое или восстановлении API
                          </span>
                          <span className="setting-description">
                            Уведомления Windows при потере связи со шлюзом TrueSOTA
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            className={`mac-action-btn ${gatewayAlertEnabled ? "copied" : ""}`}
                            onClick={handleToggleGatewayAlert}
                          >
                            {gatewayAlertEnabled ? (
                              <AnimatedBell size={13} active={gatewayAlertEnabled} />
                            ) : (
                              <BellOff size={13} />
                            )}
                            <span>{gatewayAlertEnabled ? "Включены" : "Выключены"}</span>
                          </button>
                          <button
                            type="button"
                            className="mac-action-btn"
                            onClick={handleTestNotification}
                            title="Отправить тестовое уведомление Windows"
                          >
                            <span>Тест</span>
                          </button>
                        </div>
                      </div>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
              </div>

              <div className="settings-col">
                <Accordion multiple defaultOpen={["window", "security"]}>
                  <AccordionItem value="window">
                    <AccordionTrigger
                      icon={<Maximize2 size={14} />}
                      meta={
                        windowLayout === "fullscreen"
                          ? "Full HD"
                          : windowLayout === "wide"
                            ? "1600×940"
                            : windowLayout === "compact_win"
                              ? "880×880"
                              : "620×900"
                      }
                    >
                      Окно Windows 11, стекло и виджеты
                    </AccordionTrigger>
                    <AccordionPanel>
                      <div className="setting-row">
                        <div className="setting-label-col">
                          <span className="setting-name">
                            Размер окна (620×900 / 1920×1080)
                          </span>
                          <span className="setting-description">
                            Портретная карточка по умолчанию или широкий / Full HD режим
                          </span>
                        </div>
                        <div className="backdrop-segmented">
                          {(
                            [
                              { id: "portrait", label: "620×900" },
                              { id: "compact_win", label: "880×880" },
                              { id: "wide", label: "1600×940" },
                              { id: "fullscreen", label: "Full HD" },
                            ] as const
                          ).map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              className={`backdrop-chip ${windowLayout === preset.id ? "active" : ""}`}
                              onClick={() => void handleSelectWindowLayout(preset.id)}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="info-divider" style={{ margin: "12px 0" }} />

                      <div className="setting-row">
                        <div className="setting-label-col">
                          <span className="setting-name">Эффект прозрачности окна</span>
                          <span className="setting-description">
                            Чистый OLED Black или нативное стекло DWM без системных рамок
                          </span>
                        </div>
                        <div className="backdrop-segmented">
                          {(["oled", "mica", "acrylic", "tabbed"] as BackdropMode[]).map(
                            (mode) => (
                              <button
                                key={mode}
                                type="button"
                                className={`backdrop-chip ${backdropMode === mode ? "active" : ""}`}
                                onClick={() => handleSelectBackdrop(mode)}
                              >
                                {mode === "oled"
                                  ? "OLED Black"
                                  : mode === "mica"
                                    ? "Mica"
                                    : mode === "acrylic"
                                      ? "Acrylic"
                                      : "Tabbed"}
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      <div className="info-divider" style={{ margin: "12px 0" }} />

                      <div className="setting-row">
                        <div className="setting-label-col">
                          <span className="setting-name">Плавающий Dynamic Island</span>
                          <span className="setting-description">
                            Компактный виджет поверх всех окон рабочего стола
                          </span>
                        </div>
                        <button
                          type="button"
                          className="mac-btn-accent"
                          onClick={toggleIslandMode}
                        >
                          Перейти в Островок
                        </button>
                      </div>

                      <div className="info-divider" style={{ margin: "12px 0" }} />

                      <div className="setting-row">
                        <div className="setting-label-col">
                          <span className="setting-name">Apple Share Card & Отчёты</span>
                          <span className="setting-description">
                            Экспорт PNG-карточки для Telegram, CSV и Markdown
                          </span>
                        </div>
                        <button
                          type="button"
                          className="mac-action-btn"
                          onClick={() => {
                            appleAudio.playTap();
                            setShareModalOpen(true);
                          }}
                        >
                          <Share2 size={13} />
                          <span>Открыть экспорт</span>
                        </button>
                      </div>
                    </AccordionPanel>
                  </AccordionItem>

                  <AccordionItem value="security">
                    <AccordionTrigger
                      icon={<ShieldCheck size={14} />}
                      meta={keyStorage.method}
                    >
                      Безопасность (DPAPI), обновления и автор
                    </AccordionTrigger>
                    <AccordionPanel>
                      <div className="setting-row">
                        <div className="setting-label-col">
                          <span className="setting-name">Защита сохранённого ключа</span>
                          <span className="setting-description">
                            Привязка шифрования к учётной записи Windows в{" "}
                            <code>%APPDATA%\TrueSOTA_Monitor</code>
                          </span>
                        </div>
                        <span className="dpapi-status-badge">
                          <ShieldCheck size={13} />
                          <span>{keyStorage.method}</span>
                        </span>
                      </div>

                      <div className="info-divider" style={{ margin: "12px 0" }} />

                      <div className="setting-row">
                        <div className="setting-label-col">
                          <span className="setting-name">
                            Обновления с GitHub (
                            <code>v{updateInfo?.current_version || "1.3.0"}</code>)
                          </span>
                          <span className="setting-description">
                            {updateError
                              ? updateError
                              : updateInfo
                                ? updateInfo.has_update
                                  ? `Доступна новая версия ${updateInfo.latest_version}`
                                  : `У вас актуальная версия (${updateInfo.latest_version})`
                                : "Проверка релизов afk3drp-dev/truesota-monitor"}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            type="button"
                            className={`mac-action-btn ${autoCheckUpdates ? "copied" : ""}`}
                            onClick={handleToggleAutoUpdates}
                          >
                            <span>Авто: {autoCheckUpdates ? "Вкл" : "Выкл"}</span>
                          </button>
                          <button
                            type="button"
                            className="mac-action-btn"
                            disabled={checkingUpdate}
                            onClick={() => void handleCheckUpdates(false)}
                          >
                            <AnimatedRefreshCw size={13} spinning={checkingUpdate} />
                            <span>
                              {checkingUpdate ? "Проверка..." : "Проверить"}
                            </span>
                          </button>
                          {updateInfo?.has_update && (
                            <button
                              type="button"
                              className="mac-btn-accent"
                              onClick={handleOpenUpdateRelease}
                            >
                              <AnimatedDownload size={13} />
                              <span>Скачать {updateInfo.latest_version}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="info-divider" style={{ margin: "12px 0" }} />

                      <TelegramCredit variant="card" />
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>

            <div className="settings-group settings-group-full">
              <Accordion multiple={false}>
                <AccordionItem value="json">
                  <AccordionTrigger
                    icon={<Database size={14} />}
                    meta="Live Payload"
                  >
                    Ответ сервера (JSON Inspector)
                  </AccordionTrigger>
                  <AccordionPanel>
                    <div className="raw-json-card">
                      <pre className="raw-json-code">
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    </div>
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        )}
      </main>

      {/* macOS Subtle Glass Footer */}
      <footer className="mac-footer">
        <div className="footer-left-group">
          <span className="footer-status-text">
            {lastUpdated ? (
              <>
                Обновлено: <strong>{lastUpdated}</strong> • Экономия кэша:{" "}
                <strong>{cacheHitPct.toFixed(1)}%</strong>
              </>
            ) : (
              "Ожидание первого запроса..."
            )}
          </span>
          <TelegramCredit variant="pill" />
        </div>
        <div className="footer-actions-group">
          <button
            type="button"
            className="mac-action-btn"
            onClick={() => {
              appleAudio.playTap();
              setCommandPaletteOpen(true);
            }}
            title="Быстрые команды Ctrl+K"
          >
            <Command size={12} />
            <span>Ctrl+K</span>
          </button>
          <button
            type="button"
            className="mac-action-btn"
            onClick={() => {
              appleAudio.playTap();
              setShareModalOpen(true);
            }}
          >
            <Share2 size={12} />
            <span>Карточка</span>
          </button>
          <button
            type="button"
            className={`mac-action-btn ${copied ? "copied" : ""}`}
            onClick={handleCopyReport}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? "Скопировано" : "Сводка"}</span>
          </button>
        </div>
      </footer>

      {/* Spotlight Ctrl+K & Apple Share Card Modals */}
      <ShareCardModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        data={{
          mode: data?.mode,
          status: data?.status,
          remaining,
          limit,
          used,
          pctRemaining: percent,
          totalTokens,
          totalRequests: totalReq,
          cacheHitPct,
          savedUsd: totalSaved,
          avgDurationMs: data?.usage?.average_duration_ms ?? 0,
          modelStats: data?.model_stats || [],
          dailyUsage: data?.daily_usage || [],
        }}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectTab={(t) => handleTabChange(t)}
        onSearchModel={(mdl) => setModelSearch(mdl)}
        onRefresh={() => {
          appleAudio.playTap();
          loadData();
        }}
        onToggleCompact={toggleIslandMode}
        onOpenShareCard={() => setShareModalOpen(true)}
        onToggleSound={toggleSound}
        soundEnabled={soundEnabled}
        backdropMode={backdropMode}
        onSelectBackdrop={handleSelectBackdrop}
        windowLayout={windowLayout}
        onSelectWindowLayout={(preset) => void handleSelectWindowLayout(preset)}
        onSignOut={handleSignOut}
        onCheckUpdates={() => {
          setActiveTab("settings");
          void handleCheckUpdates(false);
        }}
        onHideToTray={() => void invoke("window_hide_to_tray")}
        onQuitApp={() => void invoke("window_quit")}
        modelStats={data?.model_stats || []}
      />
    </div>
  );
}
