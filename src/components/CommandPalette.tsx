import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  BarChart3,
  Calendar,
  Activity,
  Cpu,
  Clock,
  Layers,
  SlidersHorizontal,
  RefreshCw,
  Minimize2,
  Share2,
  Sparkles,
  Volume2,
  CornerDownLeft,
  LogOut,
} from "lucide-react";
import { ModelLogo } from "./ModelLogo";
import type { CacheModelStatItem } from "./ActivityHeatmap";

export type AppTab =
  | "overview"
  | "pricing"
  | "monitor"
  | "analytics"
  | "models"
  | "history"
  | "settings";

export type BackdropMode = "mica" | "acrylic" | "tabbed" | "oled";

interface CommandItem {
  id: string;
  section: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  icon: React.ReactNode;
  keywords: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectTab: (tab: AppTab) => void;
  onSearchModel: (modelName: string) => void;
  onRefresh: () => void;
  onToggleCompact: () => void;
  onOpenShareCard: () => void;
  onToggleSound: () => void;
  soundEnabled: boolean;
  backdropMode: BackdropMode;
  onSelectBackdrop: (mode: BackdropMode) => void;
  onSignOut?: () => void;
  modelStats: CacheModelStatItem[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onSelectTab,
  onSearchModel,
  onRefresh,
  onToggleCompact,
  onOpenShareCard,
  onToggleSound,
  soundEnabled,
  backdropMode,
  onSelectBackdrop,
  onSignOut,
  modelStats,
}) => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const items = useMemo<CommandItem[]>(() => {
    const base: CommandItem[] = [
      {
        id: "tab-overview",
        section: "Навигация",
        title: "Обзор",
        subtitle: "Квота, кольцо прогресса и суточная сводка",
        icon: <BarChart3 size={15} />,
        keywords: "обзор overview квота главная dashboard",
        action: () => {
          onSelectTab("overview");
          onClose();
        },
      },
      {
        id: "tab-pricing",
        section: "Навигация",
        title: "Тарифы и группы",
        subtitle: "Цены моделей, множители групп и Channel Monitor",
        icon: <Layers size={15} />,
        keywords: "тарифы цены pricing группы множитель rate каналы monitor",
        action: () => {
          onSelectTab("pricing");
          onClose();
        },
      },
      {
        id: "tab-monitor",
        section: "Навигация",
        title: "Монитор каналов (Live)",
        subtitle: "Встроенный true-sota.com/monitor + пинг API-шлюза",
        icon: <Activity size={15} />,
        keywords: "монитор monitor статус каналы ping шлюз uptime latency",
        action: () => {
          onSelectTab("monitor");
          onClose();
        },
      },
      {
        id: "tab-analytics",
        section: "Навигация",
        title: "Аналитика: Heatmap & Кэш",
        subtitle: "Тепловая карта за 22 недели и аудит экономии кэша",
        icon: <Calendar size={15} />,
        keywords: "аналитика heatmap тепловая карта кэш cache profiler streak",
        action: () => {
          onSelectTab("analytics");
          onClose();
        },
      },
      {
        id: "tab-models",
        section: "Навигация",
        title: "Модели",
        subtitle: `Все модели (${modelStats.length}) с логотипами и ценой`,
        icon: <Cpu size={15} />,
        keywords: "модели models gpt claude glm deepseek",
        action: () => {
          onSelectTab("models");
          onClose();
        },
      },
      {
        id: "tab-history",
        section: "Навигация",
        title: "История",
        subtitle: "Таблица расхода по дням",
        icon: <Clock size={15} />,
        keywords: "история history дни расходы",
        action: () => {
          onSelectTab("history");
          onClose();
        },
      },
      {
        id: "tab-settings",
        section: "Навигация",
        title: "Настройки",
        subtitle: "API ключ, интервал и эффект стекла",
        icon: <SlidersHorizontal size={15} />,
        keywords: "настройки settings ключ api mica acrylic",
        action: () => {
          onSelectTab("settings");
          onClose();
        },
      },
      {
        id: "act-refresh",
        section: "Действия",
        title: "Обновить статистику сейчас",
        subtitle: "Запросить свежую квоту с TrueSOTA API",
        shortcut: "F5",
        icon: <RefreshCw size={15} />,
        keywords: "обновить refresh sync загрузить",
        action: () => {
          onRefresh();
          onClose();
        },
      },
      {
        id: "act-island",
        section: "Действия",
        title: "Перейти в Dynamic Island",
        subtitle: "Компактный плавающий виджет поверх окон",
        icon: <Minimize2 size={15} />,
        keywords: "островок dynamic island мини виджет поверх",
        action: () => {
          onToggleCompact();
          onClose();
        },
      },
      {
        id: "act-share",
        section: "Действия",
        title: "Создать Apple Share Card / Экспорт",
        subtitle: "PNG для Telegram, CSV и Markdown отчёт",
        icon: <Share2 size={15} style={{ color: "#0a84ff" }} />,
        keywords: "share card telegram png csv markdown экспорт отчёт",
        action: () => {
          onClose();
          onOpenShareCard();
        },
      },
      {
        id: "act-sound",
        section: "Действия",
        title: soundEnabled ? "Отключить звуки интерфейса" : "Включить звуки интерфейса",
        subtitle: "Apple-тапы и уведомления Web Audio",
        icon: <Volume2 size={15} />,
        keywords: "звук audio mute unmute",
        action: () => {
          onToggleSound();
          onClose();
        },
      },
      {
        id: "mat-mica",
        section: "Окно и стекло (Windows)",
        title: "Стекло: Mica (Windows 11)",
        subtitle: backdropMode === "mica" ? "Выбрано сейчас" : "Мягкий системный материал",
        icon: <Sparkles size={15} style={{ color: "#64d2ff" }} />,
        keywords: "mica стекло прозрачность фон backdrop",
        action: () => {
          onSelectBackdrop("mica");
          onClose();
        },
      },
      {
        id: "mat-acrylic",
        section: "Окно и стекло (Windows)",
        title: "Стекло: Acrylic Frost",
        subtitle:
          backdropMode === "acrylic" ? "Выбрано сейчас" : "Глубокое матовое размытие",
        icon: <Sparkles size={15} style={{ color: "#bf5af2" }} />,
        keywords: "acrylic матовое стекло blur backdrop",
        action: () => {
          onSelectBackdrop("acrylic");
          onClose();
        },
      },
      {
        id: "mat-oled",
        section: "Окно и стекло (Windows)",
        title: "Стекло: Pure OLED Black",
        subtitle:
          backdropMode === "oled" ? "Выбрано сейчас" : "Глубокий чёрный фон без прозрачности",
        icon: <Sparkles size={15} />,
        keywords: "oled black темный фон без стекла",
        action: () => {
          onSelectBackdrop("oled");
          onClose();
        },
      },
      ...(onSignOut
        ? [
            {
              id: "act-signout",
              section: "Аккаунт",
              title: "Выйти / Сменить API ключ",
              subtitle: "Удалить сохранённый ключ и вернуться на экран входа",
              icon: <LogOut size={15} style={{ color: "#ff453a" }} />,
              keywords: "выйти сменить ключ logout signout key аккаунт",
              action: () => {
                onClose();
                onSignOut();
              },
            },
          ]
        : []),
    ];

    const modelCmds: CommandItem[] = modelStats.slice(0, 15).map((m) => ({
      id: `mdl-${m.model}`,
      section: "Быстрый переход к модели",
      title: m.model,
      subtitle: `${m.requests} запр. • $${(m.actual_cost || 0).toFixed(3)}`,
      icon: <ModelLogo model={m.model} size={18} withBadge={false} />,
      keywords: `модель model ${m.model}`,
      action: () => {
        onSearchModel(m.model);
        onSelectTab("models");
        onClose();
      },
    }));

    return [...base, ...modelCmds];
  }, [
    backdropMode,
    modelStats,
    onClose,
    onOpenShareCard,
    onRefresh,
    onSearchModel,
    onSelectBackdrop,
    onSelectTab,
    onSignOut,
    onToggleCompact,
    onToggleSound,
    soundEnabled,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items
      .filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          (it.subtitle || "").toLowerCase().includes(q) ||
          it.keywords.toLowerCase().includes(q),
      )
      .slice(0, 14);
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (filtered.length > 0 ? (i + 1) % filtered.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) =>
          filtered.length > 0 ? (i - 1 + filtered.length) % filtered.length : 0,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const chosen = filtered[activeIndex];
        if (chosen) chosen.action();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, filtered, onClose, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop spotlight-backdrop" onClick={onClose}>
      <div className="spotlight-modal" onClick={(e) => e.stopPropagation()}>
        <div className="spotlight-input-row">
          <Search size={16} className="spotlight-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="spotlight-input"
            placeholder="Поиск команды, модели, эффекта стекла..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="spotlight-esc">ESC</kbd>
        </div>

        <div className="spotlight-list">
          {filtered.length === 0 ? (
            <div className="spotlight-empty">Ничего не найдено</div>
          ) : (
            filtered.map((item, idx) => {
              const showSection =
                idx === 0 || filtered[idx - 1].section !== item.section;
              return (
                <React.Fragment key={item.id}>
                  {showSection && (
                    <div className="spotlight-section">{item.section}</div>
                  )}
                  <button
                    type="button"
                    className={`spotlight-item ${
                      idx === activeIndex ? "active" : ""
                    }`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={item.action}
                  >
                    <span className="spotlight-item-icon">{item.icon}</span>
                    <div className="spotlight-item-text">
                      <span className="spotlight-item-title">{item.title}</span>
                      {item.subtitle && (
                        <span className="spotlight-item-sub">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                    {item.shortcut ? (
                      <kbd className="spotlight-kbd">{item.shortcut}</kbd>
                    ) : idx === activeIndex ? (
                      <CornerDownLeft
                        size={13}
                        className="spotlight-enter-hint"
                      />
                    ) : null}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="spotlight-footer">
          <span>↑↓ навигация</span>
          <span>↵ выбрать</span>
          <span>Ctrl+K открыть/закрыть</span>
        </div>
      </div>
    </div>
  );
};
