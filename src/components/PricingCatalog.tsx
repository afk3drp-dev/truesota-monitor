import React, { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Activity,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { ModelLogo } from "./ModelLogo";
import { appleAudio } from "../utils/audio";

export interface PricingGroup {
  id: number;
  name: string;
  platform: string;
  channel_id?: number;
  rate_multiplier?: number;
  user_rate_multiplier?: number;
  peak_rate_enabled?: boolean;
  peak_start?: string;
  peak_end?: string;
  peak_rate_multiplier?: number;
  image_rate_independent?: boolean;
  image_rate_multiplier?: number;
  video_rate_independent?: boolean;
  video_rate_multiplier?: number;
}

export interface PricingChannel {
  id: number;
  name: string;
  description?: string;
  group_ids?: number[];
}

export interface PricingInterval {
  min_tokens?: number;
  max_tokens?: number | null;
  tier_label?: string;
  per_request_price?: number | null;
}

export interface ModelPricingDetail {
  billing_mode?: string;
  input_price?: number | null;
  output_price?: number | null;
  cache_write_price?: number | null;
  cache_read_price?: number | null;
  image_input_price?: number | null;
  image_output_price?: number | null;
  per_request_price?: number | null;
  intervals?: PricingInterval[];
}

export interface PricingModelRaw {
  name: string;
  platform: string;
  group_id: number;
  input_price?: number | null;
  output_price?: number | null;
  cache_price?: number | null;
  protocols?: string[];
  pricing?: ModelPricingDetail;
}

export interface PublicPricingCatalogData {
  groups: PricingGroup[];
  models: PricingModelRaw[];
  channels?: PricingChannel[];
  cache_ttl_seconds?: number;
}

interface PricingRow {
  rowKey: string;
  model: string;
  platform: string;
  groupId: number;
  groupName: string;
  rate: number;
  billingMode: string;
  inputPerToken: number | null;
  outputPerToken: number | null;
  cacheReadPerToken: number | null;
  cacheWritePerToken: number | null;
  unitPrices: { label: string | null; price: number }[];
  protocols: string[];
  peakHint: string | null;
  keyUnlocked: boolean;
}

interface PricingCatalogProps {
  apiKey: string;
  onOpenMonitorTab?: () => void;
}

type SortKey = "default" | "cheapest" | "expensive" | "name";

const PROTOCOL_LABELS: Record<string, string> = {
  openai_chat: "Chat",
  openai_responses: "Responses",
  anthropic: "Claude",
  google: "Gemini",
};

function resolveGroupRate(group: PricingGroup | undefined, billingMode: string): number {
  if (!group) return 1;
  const base = group.user_rate_multiplier ?? group.rate_multiplier;
  const special =
    billingMode === "image" && group.image_rate_independent
      ? group.image_rate_multiplier
      : billingMode === "video" && group.video_rate_independent
        ? group.video_rate_multiplier
        : undefined;
  if (special != null && Number.isFinite(special)) return special;
  return base != null && Number.isFinite(base) ? base : 1;
}

function formatScaledUsd(
  rawPrice: number | null | undefined,
  rate: number,
  scale: number,
): string {
  if (rawPrice == null || !Number.isFinite(rawPrice)) return "—";
  const scaled = rawPrice * (Number.isFinite(rate) ? rate : 1) * scale;
  let formatted = scaled.toPrecision(10).replace(/\.?0+$/, "");
  if (!formatted.includes("e")) {
    const dot = formatted.indexOf(".");
    const decimals = dot === -1 ? 0 : formatted.length - dot - 1;
    if (decimals < 2) {
      formatted = (dot === -1 ? `${formatted}.` : formatted) + "0".repeat(2 - decimals);
    }
  }
  return `$${formatted}`;
}

export const PricingCatalog: React.FC<PricingCatalogProps> = ({
  apiKey,
  onOpenMonitorTab,
}) => {
  const [catalog, setCatalog] = useState<PublicPricingCatalogData | null>(null);
  const [keyModels, setKeyModels] = useState<Set<string>>(new Set());
  const [keyModelsStatus, setKeyModelsStatus] = useState<"idle" | "ok" | "unavailable">("idle");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyMyKey, setOnlyMyKey] = useState<boolean>(false);
  const [applyGroupRate, setApplyGroupRate] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<SortKey>("default");
  const [copiedModel, setCopiedModel] = useState<string | null>(null);

  const loadPricingAndModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pricingRes, keyRes] = await Promise.allSettled([
        invoke<PublicPricingCatalogData>("fetch_model_pricing"),
        apiKey.trim()
          ? invoke<string[]>("fetch_key_models", { apiKey: apiKey.trim() })
          : Promise.resolve([] as string[]),
      ]);

      if (pricingRes.status === "fulfilled") {
        setCatalog(pricingRes.value);
      } else {
        setError(String(pricingRes.reason));
      }

      if (keyRes.status === "fulfilled" && keyRes.value.length > 0) {
        setKeyModels(new Set(keyRes.value.map((m) => m.toLowerCase())));
        setKeyModelsStatus("ok");
      } else {
        setKeyModels(new Set());
        setKeyModelsStatus(apiKey.trim() ? "unavailable" : "idle");
      }
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    loadPricingAndModels();
  }, [loadPricingAndModels]);

  const groupMap = useMemo(() => {
    const map = new Map<number, PricingGroup>();
    for (const g of catalog?.groups ?? []) {
      map.set(g.id, g);
    }
    return map;
  }, [catalog]);

  const channelByGroupId = useMemo(() => {
    const map = new Map<number, PricingChannel>();
    for (const ch of catalog?.channels ?? []) {
      for (const gid of ch.group_ids ?? []) {
        map.set(gid, ch);
      }
    }
    return map;
  }, [catalog]);

  const groupCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const m of catalog?.models ?? []) {
      counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
    }
    return counts;
  }, [catalog]);

  const allRows: PricingRow[] = useMemo(() => {
    if (!catalog) return [];
    return catalog.models.map((m, idx) => {
      const group = groupMap.get(m.group_id);
      const billingMode = m.pricing?.billing_mode || "token";
      const rate = applyGroupRate ? resolveGroupRate(group, billingMode) : 1;

      const unitPrices: { label: string | null; price: number }[] = [];
      if (billingMode !== "token" && m.pricing) {
        for (const iv of m.pricing.intervals ?? []) {
          if (iv.per_request_price != null) {
            const label =
              iv.tier_label?.trim() ||
              (iv.max_tokens == null
                ? `>${iv.min_tokens ?? 0}`
                : `${iv.min_tokens ?? 0}–${iv.max_tokens}`);
            unitPrices.push({ label, price: iv.per_request_price });
          }
        }
        if (m.pricing.per_request_price != null) {
          unitPrices.push({ label: null, price: m.pricing.per_request_price });
        }
      }

      const peakHint =
        group?.peak_rate_enabled && group.peak_start && group.peak_end
          ? `${group.peak_start}–${group.peak_end} (×${group.peak_rate_multiplier ?? 1})`
          : null;

      return {
        rowKey: `${m.group_id}:${m.platform}:${m.name}:${idx}`,
        model: m.name,
        platform: m.platform,
        groupId: m.group_id,
        groupName: group?.name ?? `Group #${m.group_id}`,
        rate,
        billingMode,
        inputPerToken: m.pricing?.input_price ?? m.input_price ?? null,
        outputPerToken: m.pricing?.output_price ?? m.output_price ?? null,
        cacheReadPerToken: m.pricing?.cache_read_price ?? m.cache_price ?? null,
        cacheWritePerToken: m.pricing?.cache_write_price ?? null,
        unitPrices,
        protocols: m.protocols ?? [],
        peakHint,
        keyUnlocked: keyModels.has(m.name.toLowerCase()),
      };
    });
  }, [catalog, groupMap, applyGroupRate, keyModels]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = allRows.filter((row) => {
      if (selectedGroupId !== "all" && row.groupId !== selectedGroupId) return false;
      if (onlyMyKey && keyModelsStatus === "ok" && !row.keyUnlocked) return false;
      if (q) {
        const hay = `${row.model} ${row.platform} ${row.groupName} ${row.protocols.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === "name") {
      list = [...list].sort((a, b) => a.model.localeCompare(b.model));
    } else if (sortBy === "cheapest") {
      list = [...list].sort((a, b) => {
        const av =
          a.billingMode === "token"
            ? (a.outputPerToken ?? Number.POSITIVE_INFINITY) * a.rate * 1e6
            : (a.unitPrices[0]?.price ?? Number.POSITIVE_INFINITY) * a.rate;
        const bv =
          b.billingMode === "token"
            ? (b.outputPerToken ?? Number.POSITIVE_INFINITY) * b.rate * 1e6
            : (b.unitPrices[0]?.price ?? Number.POSITIVE_INFINITY) * b.rate;
        return av - bv;
      });
    } else if (sortBy === "expensive") {
      list = [...list].sort((a, b) => {
        const av =
          a.billingMode === "token"
            ? (a.outputPerToken ?? -1) * a.rate * 1e6
            : (a.unitPrices[0]?.price ?? -1) * a.rate;
        const bv =
          b.billingMode === "token"
            ? (b.outputPerToken ?? -1) * b.rate * 1e6
            : (b.unitPrices[0]?.price ?? -1) * b.rate;
        return bv - av;
      });
    }
    return list;
  }, [allRows, selectedGroupId, onlyMyKey, keyModelsStatus, searchQuery, sortBy]);

  const handleCopyModel = async (name: string) => {
    appleAudio.playTap();
    try {
      await navigator.clipboard.writeText(name);
      setCopiedModel(name);
      setTimeout(() => setCopiedModel((prev) => (prev === name ? null : prev)), 1500);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const handleOpenWebUrl = async (url: string) => {
    appleAudio.playTap();
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="pricing-container">
      {/* Header + Web Monitor Bridge */}
      <div className="pricing-hero-grid">
        <div className="bento-card pricing-hero-card">
          <div className="pricing-hero-top">
            <div>
              <div className="card-subhead" style={{ marginBottom: 4 }}>
                <Layers size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
                ПУБЛИЧНЫЙ ПРАЙС TRUESOTA
              </div>
              <h2 className="pricing-title">Тарифы моделей и групп</h2>
              <p className="pricing-sub">
                Актуальные цены и множители групп напрямую с{" "}
                <button
                  type="button"
                  className="pricing-inline-link"
                  onClick={() => handleOpenWebUrl("https://true-sota.com/model-pricing")}
                >
                  true-sota.com/model-pricing
                </button>
              </p>
            </div>
            <button
              type="button"
              className={`pricing-refresh-btn ${loading ? "loading" : ""}`}
              onClick={() => {
                appleAudio.playTap();
                loadPricingAndModels();
              }}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? "spin" : ""} />
              <span>{loading ? "Загрузка..." : "Обновить"}</span>
            </button>
          </div>

          <div className="pricing-stats-strip">
            <div className="pricing-stat-pill">
              <span className="pricing-stat-val">{catalog?.models.length ?? "—"}</span>
              <span className="pricing-stat-lbl">Моделей в каталоге</span>
            </div>
            <div className="pricing-stat-pill">
              <span className="pricing-stat-val">{catalog?.groups.length ?? "—"}</span>
              <span className="pricing-stat-lbl">Тарифных групп</span>
            </div>
            <div className="pricing-stat-pill">
              <span className="pricing-stat-val">
                {keyModelsStatus === "ok" ? keyModels.size : "—"}
              </span>
              <span className="pricing-stat-lbl">Доступно по ключу</span>
            </div>
          </div>
        </div>

        {/* Non-bypassing Channel Monitor Card */}
        <div className="bento-card pricing-monitor-card">
          <div className="card-subhead" style={{ marginBottom: 6 }}>
            <Activity size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
            СТАТУС КАНАЛОВ (MONITOR)
          </div>
          <p className="pricing-monitor-desc">
            Аптайм и здоровье каналов TrueSOTA отображаются во встроенной вкладке «Монитор»
            (при необходимости авторизации вход и Turnstile выполняются один раз вручную).
          </p>
          <div className="pricing-monitor-actions">
            <button
              type="button"
              className="mac-btn-accent pricing-monitor-btn"
              onClick={() => {
                if (onOpenMonitorTab) {
                  appleAudio.playTap();
                  onOpenMonitorTab();
                } else {
                  handleOpenWebUrl("https://true-sota.com/monitor");
                }
              }}
            >
              <Activity size={14} />
              <span>Открыть Channel Monitor</span>
            </button>
            <button
              type="button"
              className="pricing-refresh-btn"
              onClick={() => handleOpenWebUrl("https://true-sota.com/monitor")}
              title="Открыть в системном браузере"
            >
              <ExternalLink size={13} />
            </button>
          </div>
          {catalog?.channels && catalog.channels.length > 0 && (
            <div className="pricing-channel-list">
              {catalog.channels.map((ch) => (
                <span key={ch.id} className="pricing-channel-chip" title={ch.description || ch.name}>
                  <Sparkles size={11} />
                  {ch.name} ({ch.group_ids?.length ?? 0} гр.)
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Group Filter Pills */}
      {catalog && catalog.groups.length > 0 && (
        <div className="pricing-groups-bar" role="tablist" aria-label="Группы моделей">
          <button
            type="button"
            className={`pricing-group-chip ${selectedGroupId === "all" ? "active" : ""}`}
            onClick={() => {
              appleAudio.playSwitch();
              setSelectedGroupId("all");
            }}
          >
            <span className="pg-name">Все группы</span>
            <span className="pg-count">{catalog.models.length}</span>
          </button>
          {catalog.groups.map((grp) => {
            const count = groupCounts.get(grp.id) ?? 0;
            const rate = resolveGroupRate(grp, "token");
            const ch = channelByGroupId.get(grp.id);
            return (
              <button
                key={grp.id}
                type="button"
                className={`pricing-group-chip ${selectedGroupId === grp.id ? "active" : ""}`}
                onClick={() => {
                  appleAudio.playSwitch();
                  setSelectedGroupId(grp.id);
                }}
                title={ch ? `Канал: ${ch.name}` : undefined}
              >
                <span className="pg-name">{grp.name}</span>
                <span className={`pg-rate ${rate > 1 ? "elevated" : ""}`}>×{rate}</span>
                <span className="pg-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Search + Options Toolbar */}
      <div className="pricing-toolbar bento-card">
        <div className="pricing-search-wrap">
          <Search size={14} className="pricing-search-icon" />
          <input
            type="text"
            className="pricing-search-input"
            placeholder="Поиск модели (claude, gpt, gemini, grok, image...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="pricing-toolbar-controls">
          <button
            type="button"
            className={`pricing-toggle-btn ${applyGroupRate ? "active" : ""}`}
            onClick={() => {
              appleAudio.playTap();
              setApplyGroupRate((prev) => !prev);
            }}
            title="Показывать итоговую цену с учётом множителя группы (xRate)"
          >
            <span>Учёт ×Rate группы</span>
          </button>

          {keyModelsStatus === "ok" && (
            <button
              type="button"
              className={`pricing-toggle-btn ${onlyMyKey ? "active" : ""}`}
              onClick={() => {
                appleAudio.playTap();
                setOnlyMyKey((prev) => !prev);
              }}
            >
              <KeyRound size={13} />
              <span>Только доступные ключу ({keyModels.size})</span>
            </button>
          )}

          <select
            className="pricing-sort-select"
            value={sortBy}
            onChange={(e) => {
              appleAudio.playSwitch();
              setSortBy(e.target.value as SortKey);
            }}
            aria-label="Сортировка"
          >
            <option value="default">Порядок каталога</option>
            <option value="cheapest">Сначала дешевле</option>
            <option value="expensive">Сначала дороже</option>
            <option value="name">По имени (A–Z)</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bento-card pricing-error-box">
          <ShieldAlert size={16} />
          <span>Не удалось загрузить каталог цен: {error}</span>
        </div>
      )}

      {/* Models Table */}
      <div className="bento-card pricing-table-panel">
        <div className="pricing-table-head">
          <span>Модель и протоколы</span>
          <span>Группа</span>
          <span className="num">Input / 1M</span>
          <span className="num">Cache Read / 1M</span>
          <span className="num">Output / 1M</span>
        </div>

        {loading && !catalog ? (
          <div className="pricing-empty">Загружаем актуальный каталог TrueSOTA...</div>
        ) : filteredRows.length === 0 ? (
          <div className="pricing-empty">
            Ничего не найдено под выбранные фильтры. Попробуйте очистить поиск.
          </div>
        ) : (
          <div className="pricing-table-body">
            {filteredRows.map((row) => {
              const isToken = row.billingMode === "token";
              const isCopied = copiedModel === row.model;

              return (
                <div key={row.rowKey} className="pricing-row">
                  <div className="pr-model-cell">
                    <ModelLogo model={row.model} size={28} />
                    <div className="pr-model-meta">
                      <div className="pr-model-title-line">
                        <button
                          type="button"
                          className="pr-model-copy-btn"
                          onClick={() => handleCopyModel(row.model)}
                          title="Нажмите, чтобы скопировать ID модели"
                        >
                          <span className="pr-model-id">{row.model}</span>
                          {isCopied ? (
                            <Check size={12} className="copied-icon" />
                          ) : (
                            <Copy size={11} className="copy-icon" />
                          )}
                        </button>
                        {row.keyUnlocked && (
                          <span className="pr-key-badge" title="Доступна по вашему API ключу">
                            Key OK
                          </span>
                        )}
                      </div>
                      <div className="pr-protocols">
                        <span className="pr-plat-badge">{row.platform}</span>
                        {row.protocols.map((proto) => (
                          <span key={proto} className="pr-proto-badge">
                            {PROTOCOL_LABELS[proto] ?? proto}
                          </span>
                        ))}
                        {row.billingMode !== "token" && (
                          <span className="pr-mode-badge">{row.billingMode}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pr-group-cell">
                    <span className="pr-group-name">{row.groupName}</span>
                    <span className={`pr-rate-pill ${row.rate > 1 ? "elevated" : ""}`}>
                      ×{row.rate}
                    </span>
                    {row.peakHint && (
                      <span className="pr-peak-hint" title="Пиковый тариф">
                        {row.peakHint}
                      </span>
                    )}
                  </div>

                  {isToken ? (
                    <>
                      <div className="pr-price-cell num">
                        {formatScaledUsd(row.inputPerToken, row.rate, 1e6)}
                      </div>
                      <div className="pr-price-cell num muted">
                        {formatScaledUsd(row.cacheReadPerToken, row.rate, 1e6)}
                      </div>
                      <div className="pr-price-cell num output">
                        {formatScaledUsd(row.outputPerToken, row.rate, 1e6)}
                      </div>
                    </>
                  ) : (
                    <div className="pr-unit-price-span">
                      {row.unitPrices.length > 0 ? (
                        row.unitPrices.map((u, ui) => (
                          <span key={ui} className="pr-unit-chip">
                            {u.label ? `${u.label}: ` : "За запрос: "}
                            <strong>{formatScaledUsd(u.price, row.rate, 1)}</strong>
                          </span>
                        ))
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
