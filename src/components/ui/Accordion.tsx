import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { AnimatedChevronDown } from "./AnimatedIcons";

interface AccordionContextValue {
  openValues: string[];
  toggleValue: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

interface AccordionItemContextValue {
  value: string;
  isOpen: boolean;
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(
  null
);

export interface AccordionProps {
  children: ReactNode;
  defaultOpen?: string[];
  multiple?: boolean;
  className?: string;
}

export function Accordion({
  children,
  defaultOpen = [],
  multiple = true,
  className = "",
}: AccordionProps) {
  const [openValues, setOpenValues] = useState<string[]>(defaultOpen);

  const toggleValue = useCallback(
    (value: string) => {
      setOpenValues((prev) => {
        const exists = prev.includes(value);
        if (exists) {
          return prev.filter((item) => item !== value);
        }
        return multiple ? [...prev, value] : [value];
      });
    },
    [multiple]
  );

  return (
    <AccordionContext.Provider value={{ openValues, toggleValue }}>
      <div className={`ui-accordion ${className}`}>{children}</div>
    </AccordionContext.Provider>
  );
}

export interface AccordionItemProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function AccordionItem({
  value,
  children,
  className = "",
}: AccordionItemProps) {
  const ctx = useContext(AccordionContext);
  if (!ctx) {
    throw new Error("AccordionItem must be used inside Accordion");
  }
  const isOpen = ctx.openValues.includes(value);

  return (
    <AccordionItemContext.Provider value={{ value, isOpen }}>
      <div
        className={`ui-accordion-item ${isOpen ? "is-open" : ""} ${className}`}
        data-state={isOpen ? "open" : "closed"}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

export interface AccordionTriggerProps {
  children: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function AccordionTrigger({
  children,
  meta,
  icon,
  className = "",
}: AccordionTriggerProps) {
  const ctx = useContext(AccordionContext);
  const itemCtx = useContext(AccordionItemContext);
  const [hovered, setHovered] = useState(false);

  if (!ctx || !itemCtx) {
    throw new Error("AccordionTrigger must be used inside AccordionItem");
  }

  return (
    <button
      type="button"
      className={`ui-accordion-trigger ${className}`}
      aria-expanded={itemCtx.isOpen}
      onClick={() => ctx.toggleValue(itemCtx.value)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="ui-accordion-trigger-main">
        {icon && <span className="ui-accordion-icon">{icon}</span>}
        <span className="ui-accordion-title">{children}</span>
      </span>
      <span className="ui-accordion-right">
        {meta && <span className="ui-accordion-meta">{meta}</span>}
        <span className="ui-accordion-chevron">
          <AnimatedChevronDown
            size={15}
            rotated={itemCtx.isOpen}
            hovered={hovered}
          />
        </span>
      </span>
    </button>
  );
}

export interface AccordionPanelProps {
  children: ReactNode;
  className?: string;
}

export function AccordionPanel({
  children,
  className = "",
}: AccordionPanelProps) {
  const itemCtx = useContext(AccordionItemContext);
  if (!itemCtx) {
    throw new Error("AccordionPanel must be used inside AccordionItem");
  }

  return (
    <AnimatePresence initial={false}>
      {itemCtx.isOpen && (
        <motion.div
          key="panel"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            height: { type: "spring", stiffness: 360, damping: 34 },
            opacity: { duration: 0.18, ease: "easeOut" },
          }}
          style={{ overflow: "hidden" }}
          className={`ui-accordion-motion ${className}`}
        >
          <div className="ui-accordion-panel-inner">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
