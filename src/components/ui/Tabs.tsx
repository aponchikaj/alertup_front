import {
  createContext,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn";

/* ============================================================================
   Tabs — context-based, WAI-ARIA tabs pattern with automatic activation:
   roving tabindex, arrow-key navigation, underline active indicator.
   ========================================================================= */

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  idBase: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

const useTabsContext = (component: string): TabsContextValue => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<${component}> must be used within <Tabs>`);
  return ctx;
};

export interface TabsProps {
  /** Controlled active value. Pair with `onValueChange`. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export const Tabs = ({
  value,
  defaultValue,
  onValueChange,
  children,
  className,
}: TabsProps) => {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = value !== undefined ? value : internal;
  const idBase = useId();

  const ctx = useMemo<TabsContextValue>(
    () => ({
      value: current,
      setValue: (next: string) => {
        if (value === undefined) setInternal(next);
        onValueChange?.(next);
      },
      idBase,
    }),
    [current, value, onValueChange, idBase],
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export type TabListProps = HTMLAttributes<HTMLDivElement>;

export const TabList = ({ children, className, ...props }: TabListProps) => {
  const { setValue } = useTabsContext("TabList");
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const list = listRef.current;
    if (!list) return;
    const tabs = Array.from(
      list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'),
    );
    if (!tabs.length) return;

    const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
    let next = index;
    if (e.key === "ArrowLeft") next = index <= 0 ? tabs.length - 1 : index - 1;
    if (e.key === "ArrowRight") next = index >= tabs.length - 1 ? 0 : index + 1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;

    e.preventDefault();
    const target = tabs[next];
    target.focus();
    // Automatic activation: moving focus selects the tab.
    if (target.dataset.value) setValue(target.dataset.value);
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn("flex items-center gap-1 border-b border-line", className)}
      {...props}
    >
      {children}
    </div>
  );
};

export interface TabProps {
  value: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

export const Tab = ({ value, disabled, children, className }: TabProps) => {
  const ctx = useTabsContext("Tab");
  const selected = ctx.value === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${ctx.idBase}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${ctx.idBase}-panel-${value}`}
      // Roving tabindex; if nothing is selected yet, every tab stays reachable.
      tabIndex={selected || ctx.value === "" ? 0 : -1}
      disabled={disabled}
      data-value={value}
      onClick={() => ctx.setValue(value)}
      className={cn(
        "-mb-px inline-flex min-h-11 items-center gap-2 whitespace-nowrap",
        "border-b-2 px-4 text-sm font-medium transition-colors duration-200",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-brand text-ink"
          : "border-transparent text-ink-muted hover:border-line-strong hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
};

export interface TabPanelProps {
  value: string;
  /** When true, the panel's children only mount while the tab is active. */
  lazy?: boolean;
  children: ReactNode;
  className?: string;
}

export const TabPanel = ({ value, lazy = false, children, className }: TabPanelProps) => {
  const ctx = useTabsContext("TabPanel");
  const selected = ctx.value === value;

  if (lazy && !selected) return null;

  return (
    <div
      role="tabpanel"
      id={`${ctx.idBase}-panel-${value}`}
      aria-labelledby={`${ctx.idBase}-tab-${value}`}
      hidden={!selected}
      tabIndex={0}
      className={cn(
        "pt-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      {children}
    </div>
  );
};

export default Tabs;
