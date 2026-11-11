import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  animate,
  useMotionValue,
  type AnimationPlaybackControls,
} from "motion/react";

export interface SmoothTabItem {
  id: string;
  title: string;
  icon?: ReactNode;
  badge?: string | number;
  content?: ReactNode;
}

export interface SmoothTabProps {
  items: SmoothTabItem[];
  defaultTabId?: string;
  value?: string;
  onChange?: (tabId: string) => void;
  className?: string;
  variant?: "nav" | "compact" | "default";
  /** Render only the spring-clipped sliding tab pill bar (panels managed outside). */
  barOnly?: boolean;
  /** Optional header label aligned left of the tab list when used as a card header. */
  headerLeft?: ReactNode;
  /** Optional accessory aligned right of the tab list when used as a card header. */
  headerRight?: ReactNode;
  label?: string;
}

const RUBBER_BAND = 0.35;
const SWIPE_VELOCITY = 0.11;
const AXIS_LOCK = 6;
const VELOCITY_WINDOW = 100;
const NEIGHBOUR_OPACITY = 0.32;
const SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface TabRect {
  left: number;
  width: number;
  top: number;
  height: number;
}

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  startProgress: number;
  axis: "x" | "y" | null;
  width: number;
  samples: { x: number; t: number }[];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

function indicatorRect(rects: TabRect[], progress: number): TabRect | null {
  const last = rects.length - 1;
  if (last < 0) return null;
  const p = clamp(progress, 0, last);
  const i = Math.min(Math.floor(p), Math.max(last - 1, 0));
  const a = rects[i];
  const b = rects[Math.min(i + 1, last)];
  const t = p - i;
  let left = lerp(a.left, b.left, t);
  let width = lerp(a.width, b.width, t);
  const over = progress < 0 ? -progress : progress - last;
  if (over > 0) {
    const squash = width * Math.min(over, 0.5) * 0.4;
    width -= squash;
    if (progress > last) left += squash;
  }
  return { left, width, top: a.top, height: a.height };
}

function rubberBand(raw: number, last: number): number {
  if (raw < 0) return raw * RUBBER_BAND;
  if (raw > last) return last + (raw - last) * RUBBER_BAND;
  return raw;
}

export function SmoothTab({
  items,
  defaultTabId,
  value,
  onChange,
  className = "",
  variant = "default",
  barOnly = false,
  headerLeft,
  headerRight,
  label = "Navigation tabs",
}: SmoothTabProps) {
  const count = items.length;
  const indexOf = (id: string | undefined) =>
    Math.max(
      items.findIndex((item) => item.id === id),
      0
    );

  const [uncontrolled, setUncontrolled] = useState(() => indexOf(defaultTabId));
  const selected =
    value === undefined
      ? clamp(uncontrolled, 0, Math.max(count - 1, 0))
      : indexOf(value);
  const [initial] = useState(selected);

  const progress = useMotionValue(selected);

  const baseId = useId();
  const tablistRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rects = useRef<TabRect[]>([]);
  const size = useRef({ width: 0, height: 0 });
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const target = useRef(selected);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const reducedMotion = useRef(false);
  const latest = useRef({ count, items, selected, onChange });
  latest.current = { count, items, selected, onChange };

  const itemsSignature = items
    .map((item) => `${item.id}:${item.title}:${item.badge ?? ""}`)
    .join("|");

  const hasPanels =
    !barOnly && items.some((item) => item.content !== undefined);

  const paint = useCallback(
    (p: number) => {
      const track = trackRef.current;
      if (track && count > 0) {
        track.style.transform = `translate3d(${(-p * 100) / count}%, 0, 0)`;
      }
      panelRefs.current.forEach((panel, i) => {
        if (panel) {
          const d = Math.min(Math.abs(p - i), 1);
          panel.style.opacity = String(1 - d * (1 - NEIGHBOUR_OPACITY));
        }
      });
      const overlay = overlayRef.current;
      const r = indicatorRect(rects.current, p);
      if (overlay && r && size.current.width > 0) {
        const right = Math.max(0, size.current.width - r.left - r.width);
        const bottom = Math.max(0, size.current.height - r.top - r.height);
        const radius =
          variant === "nav" ? Math.min(10, r.height / 2) : r.height / 2;
        overlay.style.clipPath = `inset(${r.top}px ${right}px ${bottom}px ${r.left}px round ${radius}px)`;
      }
    },
    [count, variant]
  );

  useLayoutEffect(() => {
    const tablist = tablistRef.current;
    if (!tablist) return;
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const box = tablist.getBoundingClientRect();
      const ratio = box.width / (tablist.offsetWidth || 1);
      const scale = Math.abs(ratio - 1) < 0.01 ? 1 : ratio;
      size.current = { width: box.width / scale, height: box.height / scale };
      rects.current = tabRefs.current.slice(0, count).map((tab) => {
        const r = tab?.getBoundingClientRect();
        return r
          ? {
              left: (r.left - box.left) / scale,
              width: r.width / scale,
              top: (r.top - box.top) / scale,
              height: r.height / scale,
            }
          : { left: 0, width: 0, top: 0, height: 0 };
      });
      paint(progress.get());
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(tablist);
    document.fonts?.ready?.then(measure).catch(() => undefined);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [count, itemsSignature, paint, progress]);

  useEffect(() => {
    const unsubscribe = progress.on("change", paint);
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reducedMotion.current = query.matches;
    };
    sync();
    query.addEventListener("change", sync);
    return () => {
      unsubscribe();
      query.removeEventListener("change", sync);
      anim.current?.stop();
    };
  }, [paint, progress]);

  const settle = useCallback(
    (index: number, opts: { instant?: boolean; velocity?: number } = {}) => {
      target.current = index;
      anim.current?.stop();
      anim.current = null;
      if (opts.instant) {
        progress.jump(index);
        return;
      }
      anim.current = reducedMotion.current
        ? animate(progress, index, { duration: 0.14, ease: EASE_OUT })
        : animate(progress, index, { ...SPRING, velocity: opts.velocity ?? 0 });
    },
    [progress]
  );

  const select = useCallback(
    (index: number, opts?: { instant?: boolean; velocity?: number }) => {
      const { count: n, items: list, selected: current } = latest.current;
      if (n === 0) return;
      const next = clamp(index, 0, n - 1);
      settle(next, opts);
      if (next !== current) {
        setUncontrolled(next);
        latest.current.onChange?.(list[next].id);
      }
    },
    [settle]
  );

  useEffect(() => {
    if (selected !== target.current && !drag.current) {
      settle(selected);
    }
  }, [selected, settle]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const keys: Record<string, number> = {
      ArrowRight: (i + 1) % count,
      ArrowLeft: (i - 1 + count) % count,
      Home: 0,
      End: count - 1,
    };
    const next = keys[e.key];
    if (next === undefined) return;
    e.preventDefault();
    tabRefs.current[next]?.focus();
    select(next, { instant: e.repeat });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!hasPanels || count < 2 || (e.pointerType === "mouse" && e.button !== 0)) {
      return;
    }
    const targetEl = e.target as HTMLElement | null;
    if (targetEl?.closest("button, a, input, select, textarea")) {
      return;
    }
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startProgress: progress.get(),
      axis: null,
      width: e.currentTarget.clientWidth || 1,
      samples: [{ x: e.clientX, t: e.timeStamp }],
    };
  };

  const lockAxis = (current: Drag, e: PointerEvent<HTMLDivElement>) => {
    const dx = e.clientX - current.startX;
    const dy = e.clientY - current.startY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK) return;
    current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (current.axis === "x") {
      anim.current?.stop();
      current.startProgress = progress.get();
      current.startX = e.clientX;
      current.samples = [{ x: e.clientX, t: e.timeStamp }];
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.dataset.dragging = "";
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== e.pointerId) return;
    if (current.axis === null) lockAxis(current, e);
    if (current.axis !== "x") return;
    current.samples.push({ x: e.clientX, t: e.timeStamp });
    while (
      current.samples.length > 2 &&
      e.timeStamp - current.samples[0].t > VELOCITY_WINDOW
    ) {
      current.samples.shift();
    }
    const raw =
      current.startProgress - (e.clientX - current.startX) / current.width;
    progress.set(rubberBand(raw, count - 1));
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const current = drag.current;
    if (!current || current.pointerId !== e.pointerId) return;
    drag.current = null;
    delete e.currentTarget.dataset.dragging;
    if (current.axis !== "x") return;
    if (!cancelled) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
    const first = current.samples[0];
    const vx = (e.clientX - first.x) / Math.max(e.timeStamp - first.t, 1);
    const p = progress.get();
    let next = Math.round(p);
    if (!cancelled && Math.abs(vx) > SWIPE_VELOCITY) {
      next = vx < 0 ? Math.floor(p) + 1 : Math.ceil(p) - 1;
    }
    select(next, { velocity: (-vx * 1000) / current.width });
  };

  const tabId = (i: number) => `${baseId}-tab-${i}`;
  const panelId = (i: number) => `${baseId}-panel-${i}`;

  const renderTabContent = (item: SmoothTabItem, isOverlay = false) => (
    <>
      {item.icon && <span className="smooth-tab-icon">{item.icon}</span>}
      <span className="smooth-tab-label">{item.title}</span>
      {item.badge !== undefined && (
        <span
          className={`smooth-tab-badge ${isOverlay ? "is-active-badge" : ""}`}
        >
          {item.badge}
        </span>
      )}
    </>
  );

  const tabListElement = (
    <div
      aria-label={label}
      className={`smooth-tab-list variant-${variant}`}
      ref={tablistRef}
      role="tablist"
    >
      {items.map((item, i) => {
        const isSelected = i === selected;
        return (
          <button
            aria-controls={hasPanels ? panelId(i) : undefined}
            aria-selected={isSelected}
            className={`smooth-tab-item variant-${variant} ${
              isSelected ? "is-selected" : ""
            }`}
            id={tabId(i)}
            key={item.id}
            onClick={() => select(i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            tabIndex={isSelected ? 0 : -1}
            type="button"
          >
            {renderTabContent(item, false)}
          </button>
        );
      })}
      <div
        aria-hidden="true"
        className={`smooth-tab-overlay variant-${variant}`}
        ref={overlayRef}
        style={{ clipPath: "inset(0 100% 0 0)" }}
      >
        {items.map((item) => (
          <span
            className={`smooth-tab-item smooth-tab-item-overlay variant-${variant}`}
            key={item.id}
          >
            {renderTabContent(item, true)}
          </span>
        ))}
      </div>
    </div>
  );

  if (barOnly || !hasPanels) {
    return (
      <div className={`smooth-tab-shell variant-${variant} ${className}`}>
        {tabListElement}
      </div>
    );
  }

  return (
    <div className={`smooth-tab-shell is-panel-mode variant-${variant} ${className}`}>
      <div className="smooth-tab-header-row">
        {headerLeft && <div className="smooth-tab-header-left">{headerLeft}</div>}
        <div className="smooth-tab-bar-wrap">{tabListElement}</div>
        {headerRight && (
          <div className="smooth-tab-header-right">{headerRight}</div>
        )}
      </div>

      <div
        className="smooth-tab-viewport"
        onClickCapture={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onLostPointerCapture={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
      >
        <div
          className="smooth-tab-track"
          ref={trackRef}
          style={{
            width: `${count * 100}%`,
            transform: `translate3d(${(-initial * 100) / count}%, 0, 0)`,
          }}
        >
          {items.map((item, i) => (
            <div
              aria-labelledby={tabId(i)}
              className="smooth-tab-panel"
              id={panelId(i)}
              inert={i !== selected}
              key={item.id}
              ref={(el) => {
                panelRefs.current[i] = el;
              }}
              role="tabpanel"
              style={{
                width: `${100 / count}%`,
                opacity: i === initial ? 1 : NEIGHBOUR_OPACITY,
              }}
              tabIndex={i === selected ? 0 : -1}
            >
              {item.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
