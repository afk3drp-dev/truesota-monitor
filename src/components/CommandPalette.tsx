import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  BarChart3,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  CornerDownLeft,
  Cpu,
  EyeOff,
  Layers,
  LoaderCircle,
  LogOut,
  Maximize2,
  Minimize2,
  Power,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Volume2,
} from "lucide-react";
import { animate } from "motion/react";
import { ModelLogo } from "./ModelLogo";
import type { CacheModelStatItem } from "./ActivityHeatmap";
import { AnimatedDownload, AnimatedRefreshCw } from "./ui/AnimatedIcons";

export type AppTab =
  | "overview"
  | "pricing"
  | "monitor"
  | "analytics"
  | "models"
  | "history"
  | "settings";

export type BackdropMode = "mica" | "acrylic" | "tabbed" | "oled";
export type WindowLayoutPreset = "portrait" | "fullscreen" | "wide" | "compact_win";

interface CommandItem {
  id: string;
  group?: string;
  label: string;
  subtitle?: string;
  shortcut?: string[];
  icon: ReactNode;
  keywords?: string[];
  placeholder?: string;
  onSelect?: () => void;
  children?: CommandItem[];
}

interface Entry {
  item: CommandItem;
  path: CommandItem[];
}

interface Row extends Entry {
  key: string;
  matches: number[];
  score: number;
}

interface Section {
  key: string;
  label?: string;
  rows: Row[];
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
  windowLayout?: WindowLayoutPreset;
  onSelectWindowLayout?: (preset: WindowLayoutPreset) => void;
  onSignOut?: () => void;
  onCheckUpdates?: () => void;
  onHideToTray?: () => void;
  onQuitApp?: () => void;
  modelStats: CacheModelStatItem[];
}

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const HOLD_MS = 320;
const RECENT_LIMIT = 3;
const WORD_BREAK = /[\s\-_./]/;
const WHITESPACE = /\s+/g;

const isWordStart = (text: string, i: number) =>
  i === 0 || WORD_BREAK.test(text[i - 1] ?? "");

function nextWordStart(t: string, ch: string, from: number): number {
  for (let j = from; j < t.length; j++) {
    if (t[j] === ch && isWordStart(t, j)) return j;
  }
  return from;
}

function subsequence(t: string, q: string, preferWordStarts: boolean) {
  const matches: number[] = [];
  let score = 0;
  let from = 0;
  for (const ch of q) {
    let i = t.indexOf(ch, from);
    if (i < 0) return null;
    const prev = matches[matches.length - 1];
    if (preferWordStarts && (prev === undefined || i !== prev + 1)) {
      i = nextWordStart(t, ch, i);
    }
    score += prev !== undefined && i === prev + 1 ? 6 : 1;
    score += isWordStart(t, i) ? 8 : 0;
    score -= prev === undefined ? i * 0.5 : (i - prev - 1) * 0.2;
    matches.push(i);
    from = i + 1;
  }
  return { score, matches };
}

function fuzzyMatch(
  text: string,
  query: string
): { score: number; matches: number[] } | null {
  const t = text.toLowerCase();
  const q = query.toLowerCase().replace(WHITESPACE, "");
  if (!q) return { score: 0, matches: [] };
  const at = t.indexOf(q);
  if (at >= 0) {
    const matches = Array.from({ length: q.length }, (_, k) => at + k);
    return { score: 100 - at + (isWordStart(t, at) ? 30 : 0), matches };
  }
  return subsequence(t, q, true) ?? subsequence(t, q, false);
}

function scoreEntry(entry: Entry, query: string) {
  const onLabel = fuzzyMatch(entry.item.label, query);
  if (onLabel) return onLabel;
  const extra = [
    ...entry.path.map((p) => p.label),
    entry.item.subtitle ?? "",
    ...(entry.item.keywords ?? []),
  ];
  let best: number | null = null;
  for (const word of extra) {
    if (!word) continue;
    const hit = fuzzyMatch(word, query);
    if (hit && (best === null || hit.score > best)) best = hit.score;
  }
  return best === null ? null : { score: best / 2, matches: [] };
}

function flatten(items: CommandItem[], path: CommandItem[] = []): Entry[] {
  const out: Entry[] = [];
  for (const item of items) {
    out.push({ item, path });
    if (item.children) {
      out.push(...flatten(item.children, [...path, item]));
    }
  }
  return out;
}

function groupRows(rows: Row[], fallback?: string): Section[] {
  const byGroup = new Map<string, Row[]>();
  for (const row of rows) {
    const label = row.path[0]?.group ?? row.item.group ?? fallback ?? "";
    const list = byGroup.get(label) ?? [];
    list.push(row);
    byGroup.set(label, list);
  }
  return [...byGroup].map(([label, list]) => ({
    key: label || "items",
    label: label || undefined,
    rows: list,
  }));
}

function buildSections(
  page: CommandItem | undefined,
  rootItems: CommandItem[],
  query: string,
  recent: Entry[]
): Section[] {
  const items = page?.children ?? rootItems;
  const fallback = page?.label;

  if (!query.trim()) {
    const rows = items.map<Row>((item) => ({
      item,
      path: [],
      key: item.id,
      matches: [],
      score: 0,
    }));
    const sections = groupRows(rows, fallback);
    if (!page && recent.length > 0) {
      sections.unshift({
        key: "recent",
        label: "Недавние",
        rows: recent.map((e) => ({
          ...e,
          key: `recent-${e.item.id}`,
          matches: [],
          score: 0,
        })),
      });
    }
    return sections;
  }

  const rows: Row[] = [];
  for (const entry of flatten(items)) {
    const hit = scoreEntry(entry, query);
    if (hit) rows.push({ ...entry, key: entry.item.id, ...hit });
  }
  const sections = groupRows(rows, fallback);
  for (const section of sections) {
    section.rows.sort((a, b) => b.score - a.score);
  }
  return sections;
}

function findEntry(items: CommandItem[], id: string): Entry | undefined {
  return flatten(items).find((e) => e.item.id === id);
}

function Highlighted({ text, matches }: { text: string; matches: number[] }) {
  if (matches.length === 0) return <>{text}</>;
  const hit = new Set(matches);
  const parts: { start: number; text: string; on: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const on = hit.has(i);
    const last = parts[parts.length - 1];
    if (last && last.on === on) {
      last.text += text[i];
    } else {
      parts.push({ start: i, text: text[i] ?? "", on });
    }
  }
  return (
    <>
      {parts.map((p) =>
        p.on ? (
          <b className="asb-highlight" key={p.start}>
            {p.text}
          </b>
        ) : (
          <span key={p.start}>{p.text}</span>
        )
      )}
    </>
  );
}

function RowEnd({
  item,
  status,
}: {
  item: CommandItem;
  status: "pending" | "done" | undefined;
}) {
  if (status === "pending") {
    return (
      <LoaderCircle aria-hidden="true" size={14} className="asb-spin-icon" />
    );
  }
  if (status === "done") {
    return <Check aria-hidden="true" size={14} className="asb-done-icon" />;
  }
  if (item.children) {
    return (
      <ChevronRight aria-hidden="true" size={14} className="asb-arrow-icon" />
    );
  }
  if (item.shortcut?.length) {
    return (
      <span className="asb-shortcut-group">
        {item.shortcut.map((key) => (
          <kbd className="asb-kbd" key={key}>
            {key}
          </kbd>
        ))}
      </span>
    );
  }
  return null;
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
  windowLayout,
  onSelectWindowLayout,
  onSignOut,
  onCheckUpdates,
  onHideToTray,
  onQuitApp,
  modelStats,
}) => {
  const uid = useId();
  const [query, setQuery] = useState("");
  const [stack, setStack] = useState<CommandItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [running, setRunning] = useState<{
    id: string;
    phase: "pending" | "done";
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const runToken = useRef(0);
  const slideNext = useRef<-1 | 0 | 1>(0);
  const springUntil = useRef(0);

  const items = useMemo<CommandItem[]>(() => {
    const backdropChildren: CommandItem[] = [
      {
        id: "theme-oled",
        label: "Pure OLED Black",
        subtitle:
          backdropMode === "oled"
            ? "Активна · чисто чёрная тема"
            : "Абсолютно чёрная OLED поверхность",
        keywords: ["oled", "black", "чёрный", "тема"],
        icon: <Sparkles size={15} />,
        onSelect: () => onSelectBackdrop("oled"),
      },
      {
        id: "theme-mica",
        label: "Windows 11 Mica",
        subtitle:
          backdropMode === "mica"
            ? "Активна · адаптивный фон"
            : "Полупрозрачная тема Mica",
        keywords: ["mica", "windows", "тема"],
        icon: <Sparkles size={15} />,
        onSelect: () => onSelectBackdrop("mica"),
      },
      {
        id: "theme-acrylic",
        label: "Frosted Acrylic",
        subtitle:
          backdropMode === "acrylic"
            ? "Активна · матовое стекло"
            : "Эффект матового стекла Acrylic",
        keywords: ["acrylic", "glass", "акрил"],
        icon: <Sparkles size={15} />,
        onSelect: () => onSelectBackdrop("acrylic"),
      },
      {
        id: "theme-tabbed",
        label: "Mica Alt (Tabbed)",
        subtitle:
          backdropMode === "tabbed"
            ? "Активна · глубокий контраст"
            : "Контрастная глубина рабочего стола",
        keywords: ["tabbed", "mica", "alt"],
        icon: <Sparkles size={15} />,
        onSelect: () => onSelectBackdrop("tabbed"),
      },
    ];

    const windowChildren: CommandItem[] | null = onSelectWindowLayout
      ? [
          {
            id: "win-portrait",
            label: "Портрет 620×900 (по умолчанию)",
            subtitle:
              windowLayout === "portrait"
                ? "Активен · вертикальная карточка"
                : "Компактное вертикальное окно без лишних рамок",
            keywords: ["620", "900", "portrait", "вертикальный"],
            icon: <Minimize2 size={15} />,
            onSelect: () => onSelectWindowLayout("portrait"),
          },
          {
            id: "win-compact",
            label: "Компактное окно 880×880",
            subtitle:
              windowLayout === "compact_win"
                ? "Активен · квадратный формат"
                : "Аккуратное окно 880×880",
            keywords: ["compact", "880"],
            icon: <Minimize2 size={15} />,
            onSelect: () => onSelectWindowLayout("compact_win"),
          },
          {
            id: "win-wide",
            label: "Widescreen 1600×940",
            subtitle:
              windowLayout === "wide"
                ? "Активен · широкий формат"
                : "Сбалансированный широкоформатный режим",
            keywords: ["wide", "1600", "940"],
            icon: <Layers size={15} />,
            onSelect: () => onSelectWindowLayout("wide"),
          },
          {
            id: "win-fullscreen",
            label: "Full HD 1920×1080",
            subtitle:
              windowLayout === "fullscreen"
                ? "Активен · во весь экран"
                : "Развернуть на весь рабочий экран",
            keywords: ["1920", "1080", "fullscreen", "maximize"],
            icon: <Maximize2 size={15} />,
            onSelect: () => onSelectWindowLayout("fullscreen"),
          },
        ]
      : null;

    const modelChildren: CommandItem[] = modelStats.slice(0, 14).map((m) => {
      const hitPct =
        m.total_tokens > 0
          ? ((m.cache_read_tokens ?? 0) / m.total_tokens) * 100
          : 0;
      const costVal = m.actual_cost ?? m.cost ?? 0;
      return {
        id: `model-${m.model}`,
        label: m.model,
        subtitle: `${m.requests} запр. · ${hitPct.toFixed(0)}% кэш · $${costVal.toFixed(2)}`,
        keywords: ["модель", "нейросеть", m.model],
        icon: <ModelLogo model={m.model} size={18} />,
        onSelect: () => onSearchModel(m.model),
      };
    });

    const base: CommandItem[] = [
      {
        id: "act-refresh",
        group: "Быстрые действия",
        label: "Обновить данные и квоту",
        subtitle: "Запросить актуальный баланс и статистику с TrueSOTA",
        shortcut: ["R"],
        keywords: ["refresh", "update", "синхронизация"],
        icon: <AnimatedRefreshCw size={15} />,
        onSelect: onRefresh,
      },
      {
        id: "act-island",
        group: "Быстрые действия",
        label: "Режим Dynamic Island",
        subtitle: "Свернуть в компактный floating pill поверх окон",
        shortcut: ["Alt", "I"],
        keywords: ["island", "compact", "островок", "пилюля"],
        icon: <Minimize2 size={15} />,
        onSelect: onToggleCompact,
      },
      {
        id: "act-share",
        group: "Быстрые действия",
        label: "Создать Share Card (16:9)",
        subtitle: "Экспортировать карточку экономии квоты в PNG",
        shortcut: ["S"],
        keywords: ["share", "png", "export", "карточка"],
        icon: <Share2 size={15} />,
        onSelect: onOpenShareCard,
      },
      {
        id: "act-backdrop-menu",
        group: "Внешний вид и окно",
        label: "Стиль фона (OLED / Mica / Acrylic)",
        subtitle: `Сейчас: ${backdropMode.toUpperCase()}`,
        keywords: ["theme", "oled", "mica", "acrylic", "тема"],
        placeholder: "Выберите тему окна…",
        icon: <Sparkles size={15} />,
        children: backdropChildren,
      },
      ...(windowChildren
        ? [
            {
              id: "act-window-menu",
              group: "Внешний вид и окно",
              label: "Размер окна (620×900 / 1920×1080)",
              subtitle:
                windowLayout === "fullscreen"
                  ? "Full HD · развернуто"
                  : windowLayout === "wide"
                    ? "Широкое 1600×940"
                    : windowLayout === "compact_win"
                      ? "Компактное 880×880"
                      : "Портрет 620×900",
              keywords: ["1920", "1080", "fullscreen", "size", "размер"],
              placeholder: "Выберите пресет размера…",
              icon: <Maximize2 size={15} />,
              children: windowChildren,
            } satisfies CommandItem,
          ]
        : []),
      {
        id: "act-sound",
        group: "Внешний вид и окно",
        label: soundEnabled ? "Выключить звуки UI" : "Включить звуки UI",
        subtitle: "Тактильные WebAudio эффекты при кликах",
        keywords: ["sound", "audio", "звук"],
        icon: <Volume2 size={15} />,
        onSelect: onToggleSound,
      },
      {
        id: "nav-overview",
        group: "Навигация по вкладкам",
        label: "Обзор",
        subtitle: "Квота, расходы сегодня и топ моделей",
        shortcut: ["1"],
        keywords: ["overview", "главная", "квота"],
        icon: <BarChart3 size={15} />,
        onSelect: () => onSelectTab("overview"),
      },
      {
        id: "nav-pricing",
        group: "Навигация по вкладкам",
        label: "Тарифы и группы",
        subtitle: "Цены, xRate множители и доступ к моделям",
        shortcut: ["2"],
        keywords: ["pricing", "прайс", "тарифы"],
        icon: <Layers size={15} />,
        onSelect: () => onSelectTab("pricing"),
      },
      {
        id: "nav-monitor",
        group: "Навигация по вкладкам",
        label: "Live Монитор каналов",
        subtitle: "Аптайм и здоровье API каналов TrueSOTA",
        shortcut: ["3"],
        keywords: ["monitor", "статус", "каналы"],
        icon: <Activity size={15} />,
        onSelect: () => onSelectTab("monitor"),
      },
      {
        id: "nav-analytics",
        group: "Навигация по вкладкам",
        label: "Аналитика и Heatmap",
        subtitle: "Активность за 22 недели и Prompt Cache Audit",
        shortcut: ["4"],
        keywords: ["analytics", "heatmap", "кэш"],
        icon: <Calendar size={15} />,
        onSelect: () => onSelectTab("analytics"),
      },
      {
        id: "nav-models",
        group: "Навигация по вкладкам",
        label: "Рейтинг моделей",
        subtitle: "Расходы и кэш по каждой модели",
        shortcut: ["5"],
        keywords: ["models", "модели"],
        icon: <Cpu size={15} />,
        onSelect: () => onSelectTab("models"),
      },
      {
        id: "nav-history",
        group: "Навигация по вкладкам",
        label: "История логов",
        subtitle: "Детализация запросов и токенов",
        shortcut: ["6"],
        keywords: ["history", "логи", "история"],
        icon: <Clock size={15} />,
        onSelect: () => onSelectTab("history"),
      },
      {
        id: "nav-settings",
        group: "Навигация по вкладкам",
        label: "Настройки",
        subtitle: "API ключ, трей, DPAPI и обновления",
        shortcut: ["7"],
        keywords: ["settings", "config", "настройки"],
        icon: <SlidersHorizontal size={15} />,
        onSelect: () => onSelectTab("settings"),
      },
      ...(modelChildren.length > 0
        ? [
            {
              id: "models-subpage",
              group: "Нейросети",
              label: `Перейти к модели (${modelChildren.length})`,
              subtitle: "Быстрый поиск модели в вашем логе и ценах",
              keywords: ["model", "gpt", "claude", "gemini", "модель"],
              placeholder: "Поиск модели…",
              icon: <Cpu size={15} />,
              children: modelChildren,
            } satisfies CommandItem,
          ]
        : []),
      ...(onCheckUpdates
        ? [
            {
              id: "sys-updates",
              group: "Система",
              label: "Проверить обновления GitHub",
              subtitle: "Сравнить текущую версию с Releases",
              keywords: ["update", "github", "обновление", "версия"],
              icon: <AnimatedDownload size={15} />,
              onSelect: onCheckUpdates,
            } satisfies CommandItem,
          ]
        : []),
      ...(onHideToTray
        ? [
            {
              id: "sys-tray",
              group: "Система",
              label: "Свернуть в системный трей",
              subtitle: "Продолжить фоновый мониторинг в фоне",
              shortcut: ["Ctrl", "W"],
              keywords: ["tray", "hide", "трей", "свернуть"],
              icon: <EyeOff size={15} />,
              onSelect: onHideToTray,
            } satisfies CommandItem,
          ]
        : []),
      ...(onSignOut
        ? [
            {
              id: "sys-signout",
              group: "Система",
              label: "Выйти / Сменить API ключ",
              subtitle: "Удалить сохранённый ключ с устройства",
              keywords: ["logout", "signout", "ключ", "выход"],
              icon: <LogOut size={15} />,
              onSelect: onSignOut,
            } satisfies CommandItem,
          ]
        : []),
      ...(onQuitApp
        ? [
            {
              id: "sys-quit",
              group: "Система",
              label: "Закрыть программу полностью",
              subtitle: "Завершить TrueSOTA Usage Monitor и иконку трея",
              keywords: ["quit", "exit", "закрыть", "выход"],
              icon: <Power size={15} />,
              onSelect: onQuitApp,
            } satisfies CommandItem,
          ]
        : []),
    ];

    return base;
  }, [
    backdropMode,
    windowLayout,
    soundEnabled,
    modelStats,
    onRefresh,
    onToggleCompact,
    onOpenShareCard,
    onSelectBackdrop,
    onSelectWindowLayout,
    onToggleSound,
    onSelectTab,
    onSearchModel,
    onCheckUpdates,
    onHideToTray,
    onSignOut,
    onQuitApp,
  ]);

  const currentPage = stack[stack.length - 1];

  const recentEntries = useMemo(
    () =>
      recentIds
        .map((id) => findEntry(items, id))
        .filter((e): e is Entry => Boolean(e)),
    [recentIds, items]
  );

  const sections = useMemo(
    () => buildSections(currentPage, items, query, recentEntries),
    [currentPage, items, query, recentEntries]
  );

  const flatRows = useMemo(
    () => sections.flatMap((s) => s.rows),
    [sections]
  );

  const highlighted = Math.min(
    activeIndex,
    Math.max(0, flatRows.length - 1)
  );
  const highlightedKey = flatRows[highlighted]?.key;
  const isBusy = Boolean(running);

  const finishClose = useCallback(() => {
    window.clearTimeout(holdTimer.current);
    runToken.current += 1;
    setRunning(null);
    setQuery("");
    setStack([]);
    setActiveIndex(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setStack([]);
      setActiveIndex(0);
      setRunning(null);
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 25);
    } else {
      window.clearTimeout(holdTimer.current);
    }
  }, [open]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const content = contentRef.current;
    if (!(open && body && content)) return;
    let controls: ReturnType<typeof animate> | undefined;
    const fitHeight = () => {
      const h = `${content.offsetHeight}px`;
      controls?.stop();
      if (performance.now() < springUntil.current) {
        controls = animate(
          body,
          { height: h },
          { type: "spring", bounce: 0, duration: 0.28 }
        );
      } else {
        body.style.height = h;
      }
    };
    fitHeight();
    const ro = new ResizeObserver(fitHeight);
    ro.observe(content);
    return () => {
      ro.disconnect();
      controls?.stop();
    };
  }, [open]);

  useLayoutEffect(() => {
    const list = listRef.current;
    const dir = slideNext.current;
    slideNext.current = 0;
    if (!list || dir === 0) return;
    list.animate(
      [
        { transform: `translateX(${dir * 14}px)`, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 190, easing: EASE_OUT }
    );
  }, [stack.length]);

  useLayoutEffect(() => {
    const list = listRef.current;
    const row = highlightedKey
      ? document.getElementById(`${uid}-opt-${highlightedKey}`)
      : null;
    if (!(open && list && row)) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop + 6) {
      list.scrollTop = Math.max(0, top - 28);
    } else if (bottom > list.scrollTop + list.clientHeight - 6) {
      list.scrollTop = bottom - list.clientHeight + 6;
    }
  }, [open, highlightedKey, sections, uid]);

  const pushPage = (item: CommandItem) => {
    slideNext.current = 1;
    springUntil.current = performance.now() + 150;
    setStack((s) => [...s, item]);
    setQuery("");
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const popPage = () => {
    const left = stack[stack.length - 1];
    if (!left) return;
    slideNext.current = -1;
    springUntil.current = performance.now() + 150;
    const nextStack = stack.slice(0, -1);
    setStack(nextStack);
    setQuery("");
    const backIdx = buildSections(
      nextStack[nextStack.length - 1],
      items,
      "",
      recentEntries
    )
      .flatMap((s) => s.rows)
      .findIndex((r) => r.key === left.id);
    setActiveIndex(Math.max(0, backIdx));
    inputRef.current?.focus();
  };

  const runItem = (entry: Entry) => {
    const { item } = entry;
    if (isBusy) return;
    if (item.children) {
      pushPage(item);
      return;
    }
    setRecentIds((prev) =>
      [item.id, ...prev.filter((x) => x !== item.id)].slice(0, RECENT_LIMIT)
    );
    const token = ++runToken.current;
    setRunning({ id: item.id, phase: "done" });
    item.onSelect?.();
    holdTimer.current = window.setTimeout(() => {
      if (runToken.current !== token) return;
      finishClose();
    }, HOLD_MS);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (stack.length > 0 && !query) {
        popPage();
      } else {
        finishClose();
      }
      return;
    }
    if (e.key === "Backspace" && !query && stack.length > 0) {
      e.preventDefault();
      popPage();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flatRows.length > 0) {
        setActiveIndex((i) => (i + 1) % flatRows.length);
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flatRows.length > 0) {
        setActiveIndex((i) => (i - 1 + flatRows.length) % flatRows.length);
      }
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (e.key === "End" && flatRows.length > 0) {
      e.preventDefault();
      setActiveIndex(flatRows.length - 1);
      return;
    }
    if (e.key === "Enter" && flatRows[highlighted]) {
      e.preventDefault();
      runItem(flatRows[highlighted]);
    }
  };

  if (!open) return null;

  let rowOffset = 0;

  return (
    <div
      className="command-palette-overlay"
      data-testid="command-palette-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) finishClose();
      }}
    >
      <div
        aria-label="Командная палитра"
        aria-modal="true"
        className="command-palette-modal"
        data-testid="command-palette-modal"
        role="dialog"
      >
        <div className="command-input-wrap">
          <Search size={16} className="command-search-icon" />
          {stack.length > 0 && (
            <button
              className="asb-breadcrumb"
              onClick={popPage}
              title="Назад (Backspace)"
              type="button"
            >
              <span>{currentPage?.label}</span>
              <span className="asb-breadcrumb-x">×</span>
            </button>
          )}
          <input
            ref={inputRef}
            className="command-input"
            placeholder={
              currentPage?.placeholder ??
              "Поиск команд, нейросетей, пресетов окна..."
            }
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="command-kbd">ESC</kbd>
        </div>

        <div className="asb-body-shell" ref={bodyRef}>
          <div ref={contentRef}>
            <div className="command-results" ref={listRef} role="listbox">
              {flatRows.length === 0 ? (
                <div className="command-empty">
                  По запросу «{query}» ничего не найдено
                </div>
              ) : (
                sections.map((section) => (
                  <div className="command-section" key={section.key}>
                    {section.label && (
                      <div className="command-section-title">
                        {section.label}
                      </div>
                    )}
                    {section.rows.map((row) => {
                      const idx = rowOffset++;
                      const isActive = idx === highlighted;
                      const isRowRunning =
                        running?.id === row.item.id
                          ? running.phase
                          : undefined;

                      return (
                        <button
                          aria-selected={isActive}
                          className={`command-item ${
                            isActive ? "active" : ""
                          } ${isRowRunning ? "is-executed" : ""}`}
                          disabled={isBusy}
                          id={`${uid}-opt-${row.key}`}
                          key={row.key}
                          onClick={() => runItem(row)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          role="option"
                          type="button"
                        >
                          <span className="command-item-icon">
                            {row.item.icon}
                          </span>
                          <span className="command-item-text">
                            <span className="command-item-title">
                              <Highlighted
                                matches={row.matches}
                                text={row.item.label}
                              />
                              {query.trim() && row.path.length > 0 ? (
                                <span className="asb-row-crumb">
                                  · {row.path[row.path.length - 1]?.label}
                                </span>
                              ) : null}
                            </span>
                            {row.item.subtitle && (
                              <span className="command-item-sub">
                                {row.item.subtitle}
                              </span>
                            )}
                          </span>
                          <span className="asb-row-end">
                            <RowEnd item={row.item} status={isRowRunning} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="command-footer">
          <div className="command-footer-hints">
            <span>
              <CornerDownLeft size={11} /> выполнить
            </span>
            {stack.length > 0 ? (
              <span>Backspace назад</span>
            ) : (
              <span>↑↓ выбор</span>
            )}
          </div>
          <span className="command-footer-brand">TrueSOTA Command Bar</span>
        </div>
      </div>
    </div>
  );
};
