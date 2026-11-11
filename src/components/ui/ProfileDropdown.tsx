import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  EyeOff,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Square,
} from "lucide-react";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { AnimatedDownload } from "./AnimatedIcons";
import type { BackdropMode } from "../CommandPalette";

type Phase = "closed" | "open" | "closing";
type Page = "main" | "details";
type Via = "pointer" | "keyboard";

const PANEL_W = 296;
const RADIUS = 16;
const SPRING = { type: "spring", duration: 0.42, bounce: 0.14 } as const;
const INDICATOR_SPRING = { type: "spring", stiffness: 500, damping: 35 } as const;
const INSTANT = { duration: 0 } as const;
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

const NAV_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
]);

const BACKDROP_CHOICES: {
  id: BackdropMode;
  label: string;
  Icon: typeof Moon;
}[] = [
  { id: "oled", label: "OLED", Icon: Moon },
  { id: "mica", label: "Mica", Icon: Sparkles },
  { id: "acrylic", label: "Glass", Icon: Square },
  { id: "tabbed", label: "Alt", Icon: Monitor },
];

export interface ProfileDropdownProps {
  keyMasked: string;
  statusText: string;
  isHealthy: boolean;
  quotaPercent: number;
  quotaLeftText: string;
  backdropMode: BackdropMode;
  onSelectBackdrop: (mode: BackdropMode) => void;
  appVersion: string;
  updateAvailableVersion?: string | null;
  dpapiActive?: boolean;
  onOpenSettings: () => void;
  onOpenShareCard: () => void;
  onCheckUpdates: () => void;
  onHideToTray?: () => void;
  onCopyKey?: () => void;
  onSignOut: () => void;
}

const viaOf = (event: MouseEvent): Via =>
  event.detail === 0 ? "keyboard" : "pointer";

function menuItems(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return [...container.querySelectorAll<HTMLElement>("[data-menu-item]")];
}

function rowTarget(
  items: HTMLElement[],
  current: HTMLElement,
  direction: 1 | -1
): HTMLElement | undefined {
  const row = current.dataset.row;
  const rows: HTMLElement[][] = [];
  for (const item of items) {
    const prev = rows[rows.length - 1];
    if (prev && prev[0].dataset.row === item.dataset.row) {
      prev.push(item);
    } else {
      rows.push([item]);
    }
  }
  const rowIndex = rows.findIndex((group) => group[0].dataset.row === row);
  if (rowIndex === -1) return items[0];
  const nextGroup = rows[(rowIndex + direction + rows.length) % rows.length];
  const checked = nextGroup.find(
    (item) => item.getAttribute("aria-checked") === "true"
  );
  return checked ?? nextGroup[0];
}

function sideTarget(
  items: HTMLElement[],
  current: HTMLElement,
  direction: 1 | -1
): HTMLElement | undefined {
  const row = current.dataset.row;
  const group = items.filter((item) => item.dataset.row === row);
  if (group.length < 2) return undefined;
  const i = group.indexOf(current);
  return group[(i + direction + group.length) % group.length];
}

function nextTarget(
  items: HTMLElement[],
  active: Element | null,
  key: string
): HTMLElement | undefined {
  if (key === "Home") return items[0];
  if (key === "End") return items[items.length - 1];
  const current = items.find((item) => item === active);
  if (!current) {
    return key === "ArrowUp" ? items[items.length - 1] : items[0];
  }
  if (key === "ArrowLeft" || key === "ArrowRight") {
    return sideTarget(items, current, key === "ArrowRight" ? 1 : -1);
  }
  return rowTarget(items, current, key === "ArrowDown" ? 1 : -1);
}

function HoldSignOut({
  duration,
  onComplete,
}: {
  duration: number;
  onComplete: (via: Via) => void;
}) {
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const [nudge, setNudge] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const nudgeTimer = useRef<number | undefined>(undefined);
  const via = useRef<Via>("pointer");
  const completed = useRef(false);

  const clearTimers = () => {
    window.clearTimeout(timer.current);
    window.clearTimeout(nudgeTimer.current);
  };

  useEffect(() => clearTimers, []);

  const start = (source: Via) => {
    if (done) return;
    via.current = source;
    completed.current = false;
    window.clearTimeout(nudgeTimer.current);
    setNudge(false);
    setHolding(true);
    timer.current = window.setTimeout(() => {
      completed.current = true;
      setHolding(false);
      setDone(true);
      onComplete(via.current);
    }, duration);
  };

  const cancel = () => {
    window.clearTimeout(timer.current);
    setHolding((prev) => {
      if (prev && !completed.current) {
        setNudge(true);
        nudgeTimer.current = window.setTimeout(() => setNudge(false), 1600);
      }
      return false;
    });
  };

  const label = (
    <>
      <LogOut aria-hidden="true" size={14} />
      <span className="pd-hold-text">
        {done ? "Выход..." : "Выйти из аккаунта"}
      </span>
      <span className="pd-hold-hint">
        {nudge ? "Удерживайте" : "Удержать"}
      </span>
    </>
  );

  return (
    <button
      className="pd-item pd-hold-btn"
      data-menu-item=""
      data-row="sign-out"
      onBlur={cancel}
      onClick={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!e.repeat) start("keyboard");
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          cancel();
        }
      }}
      onPointerCancel={cancel}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        start("pointer");
      }}
      onPointerUp={cancel}
      role="menuitem"
      tabIndex={-1}
      type="button"
    >
      {label}
      <span
        aria-hidden="true"
        className="pd-hold-fill"
        style={{
          clipPath:
            holding || done
              ? "inset(0 0 0 0 round 10px)"
              : "inset(0 100% 0 0 round 10px)",
          transition: holding
            ? `clip-path ${duration}ms linear`
            : "clip-path 240ms cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        {label}
      </span>
    </button>
  );
}

function MenuLinkItem({
  icon,
  label,
  value,
  index,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  index: number;
  onSelect: (e: MouseEvent, run?: () => void) => void;
}) {
  return (
    <button
      className="pd-item"
      data-menu-item=""
      data-row={`item-${index}`}
      onClick={onSelect}
      role="menuitem"
      tabIndex={-1}
      type="button"
    >
      <span className="pd-item-icon">{icon}</span>
      <span className="pd-item-label">{label}</span>
      {value ? <span className="pd-item-value">{value}</span> : null}
    </button>
  );
}

export function ProfileDropdown({
  keyMasked,
  statusText,
  isHealthy,
  quotaPercent,
  quotaLeftText,
  backdropMode,
  onSelectBackdrop,
  appVersion,
  updateAvailableVersion,
  dpapiActive = true,
  onOpenSettings,
  onOpenShareCard,
  onCheckUpdates,
  onHideToTray,
  onCopyKey,
  onSignOut,
}: ProfileDropdownProps) {
  const uid = useId();
  const reduced = useReducedMotion() === true;
  const [phase, setPhase] = useState<Phase>("closed");
  const [instant, setInstant] = useState(false);
  const [page, setPage] = useState<Page>("main");
  const [openSeq, setOpenSeq] = useState(0);
  const [copiedLocal, setCopiedLocal] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>("closed");
  phaseRef.current = phase;
  const openIntent = useRef<{
    focus: "first" | "last" | "menu";
    resume: boolean;
  }>({ focus: "menu", resume: false });
  const pageFocus = useRef<"first" | "switch" | null>(null);
  const closeSeq = useRef(0);
  const targetH = useRef(0);

  const w = useMotionValue(0);
  const h = useMotionValue(0);
  const pageX = useMotionValue(0);
  const bodyOpacity = useMotionValue(1);
  const outerClip = useMotionTemplate`inset(0px 0px calc(100% - ${h}px) calc(100% - ${w}px) round ${RADIUS}px)`;
  const innerClip = useMotionTemplate`inset(1px 1px calc(100% - ${h}px + 1px) calc(100% - ${w}px + 1px) round ${RADIUS - 1}px)`;
  const pageTransform = useMotionTemplate`translate3d(${pageX}px, 0, 0)`;

  const sharedInPanel = phase === "open";
  const menuId = `${uid}-menu`;

  const pageEl = (target: Page) =>
    target === "main" ? mainRef.current : detailsRef.current;

  const openMenu = (via: Via, focus: "first" | "last" | "menu") => {
    if (phaseRef.current === "open") return;
    openIntent.current = { focus, resume: phaseRef.current === "closing" };
    closeSeq.current += 1;
    setInstant(via === "keyboard" || reduced);
    setPage("main");
    setPhase("open");
    setOpenSeq((seq) => seq + 1);
  };

  const closeMenu = (via: Via, returnFocus: boolean) => {
    if (phaseRef.current !== "open") return;
    const trigger = triggerRef.current;
    if (returnFocus) {
      trigger?.focus({ preventScroll: true });
    }
    if (via === "keyboard" || reduced || !trigger) {
      setInstant(true);
      setPhase("closed");
      return;
    }
    setInstant(false);
    setPhase("closing");
    const seq = ++closeSeq.current;
    animate(bodyOpacity, 0, { duration: 0.12, ease: EASE_OUT });
    animate(w, trigger.offsetWidth, SPRING);
    animate(h, trigger.offsetHeight, SPRING).then(() => {
      if (closeSeq.current === seq) {
        setPhase("closed");
      }
    });
  };

  const goTo = (target: Page) => {
    pageFocus.current = target === "details" ? "first" : "switch";
    setPage(target);
  };

  const runAndClose = (event: MouseEvent, fn?: () => void) => {
    fn?.();
    closeMenu(viaOf(event), true);
  };

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const main = mainRef.current;
    if (openSeq === 0 || phaseRef.current !== "open" || !trigger || !main) {
      return;
    }
    pageX.jump(0);
    targetH.current = main.offsetHeight;
    if (instant) {
      w.jump(PANEL_W);
      h.jump(targetH.current);
      bodyOpacity.jump(1);
    } else {
      if (!openIntent.current.resume) {
        w.jump(trigger.offsetWidth);
        h.jump(trigger.offsetHeight);
        bodyOpacity.jump(0);
      }
      animate(w, PANEL_W, SPRING);
      animate(h, targetH.current, SPRING);
      animate(bodyOpacity, 1, { duration: 0.2, delay: 0.04, ease: EASE_OUT });
    }
    const list = menuItems(main);
    const targets = {
      first: list[0],
      last: list[list.length - 1],
      menu: main.querySelector<HTMLElement>("[role=menu]"),
    };
    targets[openIntent.current.focus]?.focus({ preventScroll: true });
  }, [openSeq]);

  useEffect(() => {
    const el = pageEl(page);
    if (phaseRef.current !== "open" || !el) return;
    const x = page === "main" ? 0 : -PANEL_W;
    targetH.current = el.offsetHeight;
    if (reduced) {
      pageX.jump(x);
      h.jump(targetH.current);
    } else {
      animate(pageX, x, SPRING);
      animate(h, targetH.current, SPRING);
    }
    const intent = pageFocus.current;
    pageFocus.current = null;
    if (intent === "first") {
      const list = menuItems(el);
      list[0]?.focus({ preventScroll: true });
    } else if (intent === "switch") {
      el.querySelector<HTMLElement>("[data-switch]")?.focus({
        preventScroll: true,
      });
    }
  }, [page, reduced]);

  useEffect(() => {
    if (phase !== "open") return;
    const observer = new ResizeObserver(() => {
      const el = pageEl(page);
      if (!el || phaseRef.current !== "open") return;
      const next = el.offsetHeight;
      if (Math.abs(next - targetH.current) < 0.5) return;
      targetH.current = next;
      animate(h, next, reduced ? INSTANT : SPRING);
    });
    for (const el of [mainRef.current, detailsRef.current]) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [phase, page, reduced]);

  useEffect(() => {
    if (phase !== "open") return;
    const onDown = (event: globalThis.PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        closeMenu("pointer", false);
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [phase]);

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      closeMenu("keyboard", true);
      return;
    }
    if (page === "details" && event.key === "Backspace") {
      event.preventDefault();
      goTo("main");
      return;
    }
    if (!NAV_KEYS.has(event.key)) return;
    event.preventDefault();
    const active = document.activeElement;
    const target = nextTarget(menuItems(pageEl(page)), active, event.key);
    if (target) {
      target.focus({ preventScroll: true });
    } else if (page === "details" && event.key === "ArrowLeft") {
      goTo("main");
    } else if (
      event.key === "ArrowRight" &&
      active instanceof HTMLElement &&
      active.dataset.switch !== undefined
    ) {
      goTo("details");
    }
  };

  const onPanelPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const item = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-menu-item]"
    );
    if (item && document.activeElement !== item) {
      item.focus({ preventScroll: true });
    }
  };

  return (
    <div
      className={`pd-wrapper ${phase !== "closed" ? "is-elevated" : ""}`}
      ref={wrapperRef}
    >
      <button
        aria-controls={sharedInPanel ? menuId : undefined}
        aria-expanded={sharedInPanel}
        aria-haspopup="menu"
        className="pd-trigger"
        data-testid="profile-dropdown-trigger"
        onClick={(event) => {
          const via = viaOf(event);
          openMenu(via, via === "keyboard" ? "first" : "menu");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu("keyboard", event.key === "ArrowDown" ? "first" : "last");
          }
        }}
        ref={triggerRef}
        title="Меню аккаунта и темы"
        type="button"
      >
        <span className="pd-avatar-sm">
          TS
          <span
            className={`pd-status-dot ${
              isHealthy ? "is-healthy" : "is-limited"
            }`}
          />
        </span>
        <span className="pd-trigger-info">
          <span className="pd-trigger-key">{keyMasked}</span>
        </span>
        <span className="pd-trigger-pct">{Math.round(quotaPercent)}%</span>
        <ChevronsUpDown
          aria-hidden="true"
          size={12}
          className={`pd-trigger-chevron ${phase !== "closed" ? "is-hidden" : ""}`}
        />
      </button>

      {phase === "closed" ? null : (
        <div
          className="pd-floating"
          data-testid="profile-dropdown-panel"
          style={{ width: PANEL_W }}
        >
          <div aria-hidden="true" className="pd-clip-backdrop">
            <motion.div
              className="pd-clip-border"
              style={{ clipPath: outerClip }}
            />
            <motion.div
              className="pd-clip-fill"
              style={{ clipPath: innerClip }}
            />
          </div>

          <motion.div
            className={`pd-clip-content ${
              sharedInPanel ? "is-interactive" : ""
            }`}
            onKeyDown={onPanelKeyDown}
            onPointerMove={onPanelPointerMove}
            style={{ clipPath: innerClip }}
          >
            <motion.div className="pd-pages-track" style={{ transform: pageTransform }}>
              {/* PAGE 1: MAIN MENU */}
              <div
                className={`pd-page ${page !== "main" ? "is-hidden-page" : ""}`}
                inert={page !== "main"}
                ref={mainRef}
                style={{ width: PANEL_W }}
              >
                <div className="pd-account-header">
                  <span className="pd-avatar-lg">
                    TS
                    <span
                      className={`pd-status-dot-lg ${
                        isHealthy ? "is-healthy" : "is-limited"
                      }`}
                    />
                  </span>
                  <div className="pd-account-meta">
                    <div className="pd-account-title-row">
                      <span className="pd-account-name">TrueSOTA API</span>
                      <span className="pd-plan-pill">{statusText}</span>
                    </div>
                    <div className="pd-account-sub">
                      {keyMasked} · {quotaLeftText} ({quotaPercent.toFixed(1)}%)
                    </div>
                  </div>
                </div>

                <motion.div
                  aria-label="Аккаунт"
                  className="pd-menu-list"
                  id={menuId}
                  role="menu"
                  style={{ opacity: bodyOpacity }}
                  tabIndex={-1}
                >
                  <fieldset aria-label="Тема окна" className="pd-theme-row">
                    <span className="pd-theme-label">Стиль</span>
                    <span className="pd-theme-pills">
                      {BACKDROP_CHOICES.map(({ id, label, Icon }) => {
                        const checked = id === backdropMode;
                        return (
                          <button
                            aria-checked={checked}
                            aria-label={label}
                            className={`pd-theme-chip ${
                              checked ? "is-checked" : ""
                            }`}
                            data-menu-item=""
                            data-row="theme"
                            key={id}
                            onClick={() => onSelectBackdrop(id)}
                            role="menuitemradio"
                            tabIndex={-1}
                            title={label}
                            type="button"
                          >
                            {checked ? (
                              <motion.span
                                className="pd-theme-chip-bg"
                                layoutId={`${uid}-backdrop`}
                                transition={
                                  reduced ? INSTANT : INDICATOR_SPRING
                                }
                              />
                            ) : null}
                            <span className="pd-theme-chip-fg">
                              <Icon size={12} />
                            </span>
                          </button>
                        );
                      })}
                    </span>
                  </fieldset>

                  <div className="pd-separator" />

                  <MenuLinkItem
                    icon={<Settings size={14} />}
                    index={0}
                    label="Настройки и окно"
                    onSelect={(e) => runAndClose(e, onOpenSettings)}
                    value="7"
                  />
                  <MenuLinkItem
                    icon={<Share2 size={14} />}
                    index={1}
                    label="Создать Share Card"
                    onSelect={(e) => runAndClose(e, onOpenShareCard)}
                    value="16:9"
                  />
                  <MenuLinkItem
                    icon={<AnimatedDownload size={14} />}
                    index={2}
                    label="Проверить обновления"
                    onSelect={(e) => runAndClose(e, onCheckUpdates)}
                    value={
                      updateAvailableVersion
                        ? `v${updateAvailableVersion}`
                        : `v${appVersion}`
                    }
                  />
                  {onHideToTray ? (
                    <MenuLinkItem
                      icon={<EyeOff size={14} />}
                      index={3}
                      label="Свернуть в трей"
                      onSelect={(e) => runAndClose(e, onHideToTray)}
                      value="Ctrl+W"
                    />
                  ) : null}

                  <button
                    aria-expanded={page === "details"}
                    aria-haspopup="menu"
                    className="pd-item"
                    data-menu-item=""
                    data-row="switch"
                    data-switch=""
                    onClick={() => goTo("details")}
                    role="menuitem"
                    tabIndex={-1}
                    type="button"
                  >
                    <span className="pd-item-icon">
                      <KeyRound size={14} />
                    </span>
                    <span className="pd-item-label">Ключ и защита</span>
                    <span className="pd-item-value">
                      {dpapiActive ? "DPAPI" : "Local"}
                    </span>
                    <ChevronRight size={14} className="pd-chevron-muted" />
                  </button>

                  <div className="pd-separator" />

                  <HoldSignOut
                    duration={950}
                    onComplete={(via) => {
                      onSignOut();
                      closeMenu(via, true);
                    }}
                  />
                </motion.div>
              </div>

              {/* PAGE 2: KEY & SECURITY DETAILS */}
              <div
                className={`pd-page ${
                  page !== "details" ? "is-hidden-page" : ""
                }`}
                inert={page !== "details"}
                ref={detailsRef}
                style={{ width: PANEL_W }}
              >
                <motion.div
                  aria-label="Детали ключа"
                  className="pd-menu-list"
                  role="menu"
                  style={{ opacity: bodyOpacity }}
                  tabIndex={-1}
                >
                  <button
                    className="pd-item pd-back-row"
                    data-menu-item=""
                    data-row="back"
                    onClick={() => goTo("main")}
                    role="menuitem"
                    tabIndex={-1}
                    type="button"
                  >
                    <ChevronLeft size={14} />
                    <span>Назад · Ключ и защита</span>
                  </button>

                  <div className="pd-separator" />

                  <div className="pd-security-card">
                    <div className="pd-security-row">
                      <ShieldCheck size={14} />
                      <span>
                        {dpapiActive
                          ? "Шифрование Windows DPAPI активно"
                          : "Локальное хранилище токена"}
                      </span>
                    </div>
                    <div className="pd-security-kv">
                      <span>Токен</span>
                      <code>{keyMasked}</code>
                    </div>
                    <div className="pd-security-kv">
                      <span>Остаток</span>
                      <span>{quotaLeftText}</span>
                    </div>
                    <div className="pd-security-kv">
                      <span>Шлюз</span>
                      <code>true-sota.com</code>
                    </div>
                  </div>

                  {onCopyKey ? (
                    <button
                      className="pd-item"
                      data-menu-item=""
                      data-row="copy-key"
                      onClick={(e) => {
                        onCopyKey();
                        setCopiedLocal(true);
                        window.setTimeout(() => setCopiedLocal(false), 1400);
                        runAndClose(e);
                      }}
                      role="menuitem"
                      tabIndex={-1}
                      type="button"
                    >
                      <span className="pd-item-icon">
                        {copiedLocal ? <Check size={14} /> : <Copy size={14} />}
                      </span>
                      <span className="pd-item-label">
                        {copiedLocal ? "Ключ скопирован" : "Скопировать API ключ"}
                      </span>
                    </button>
                  ) : null}

                  <button
                    className="pd-item"
                    data-menu-item=""
                    data-row="edit-key"
                    onClick={(e) => runAndClose(e, onOpenSettings)}
                    role="menuitem"
                    tabIndex={-1}
                    type="button"
                  >
                    <span className="pd-item-icon">
                      <Settings size={14} />
                    </span>
                    <span className="pd-item-label">Сменить ключ в настройках</span>
                  </button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
