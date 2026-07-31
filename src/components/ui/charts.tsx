import { useEffect, useRef, type ComponentType, type ReactNode } from "react";
import { animate, stagger } from "animejs";
import { cn } from "../../lib/cn";
import { reducedMotion } from "../../lib/animations";
import type { IconProps } from "./icon";

/* ============================================================================
   Dashboard data visuals — dependency-free, token-themed, anime.js-animated.
   Everything renders real values immediately for reduced motion / no-JS-anim
   cases; animation only embellishes.
   ========================================================================= */

/* --- Stat card ------------------------------------------------------------ */

export interface StatCardProps {
  icon: ComponentType<IconProps>;
  label: string;
  /** Numbers count up on mount; strings render as-is. */
  value: number | string;
  hint?: ReactNode;
  className?: string;
}

export const StatCard = ({ icon: StatIcon, label, value, hint, className }: StatCardProps) => {
  const numRef = useRef<HTMLSpanElement>(null);
  const isNumber = typeof value === "number";

  useEffect(() => {
    const el = numRef.current;
    if (!el || !isNumber) return;
    if (reducedMotion()) {
      el.textContent = value.toLocaleString();
      return;
    }
    const state = { v: 0 };
    const anim = animate(state, {
      v: value,
      duration: 1300,
      ease: "outExpo",
      onUpdate: () => {
        el.textContent = Math.round(state.v).toLocaleString();
      },
    });
    return () => {
      anim.cancel();
    };
  }, [value, isNumber]);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm",
        "transition-[transform,box-shadow,border-color] duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-brand-border hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-subtle text-brand-text">
          <StatIcon size={18} />
        </span>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-ink">
        {isNumber ? <span ref={numRef}>{value.toLocaleString()}</span> : value}
      </p>
      {hint && <p className="text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
};

/* --- Bar chart ------------------------------------------------------------ */

export interface BarDatum {
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarDatum[];
  /** Announced to assistive tech in place of the visual. */
  ariaLabel: string;
  /** Shown under the first / middle / last bars. */
  formatTick?: (label: string) => string;
  className?: string;
}

/**
 * Vertical bar chart. Bars grow in with a stagger; hovering (or focusing the
 * chart) reveals per-bar values via the native title tooltip, and the exact
 * numbers are always available to screen readers as text.
 */
export const BarChart = ({ data, ariaLabel, formatTick, className }: BarChartProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const max = Math.max(...data.map((d) => d.value), 1);

  useEffect(() => {
    const root = ref.current;
    if (!root || reducedMotion()) return;
    const bars = root.querySelectorAll<HTMLElement>("[data-bar]");
    if (!bars.length) return;
    const anim = animate(bars, {
      scaleY: [0, 1],
      duration: 850,
      delay: stagger(40),
      ease: "outQuint",
    });
    return () => {
      anim.cancel();
    };
  }, [data]);

  const tick = (label: string) => (formatTick ? formatTick(label) : label);

  return (
    <div ref={ref} className={className}>
      <div role="img" aria-label={ariaLabel} className="flex h-44 items-end gap-1.5">
        {data.map((d) => (
          <div
            key={d.label}
            title={`${tick(d.label)}: ${d.value}`}
            className="group flex h-full flex-1 flex-col justify-end"
          >
            <div
              data-bar
              style={{
                height: `${Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0)}%`,
                transformOrigin: "bottom",
              }}
              className={cn(
                "w-full rounded-t-md transition-colors duration-150",
                d.value > 0
                  ? "bg-gradient-to-t from-brand-600 to-brand-300 group-hover:to-brand-200"
                  : "h-[3px] rounded-full bg-line",
              )}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-xs text-ink-subtle">
        <span>{data.length > 0 && tick(data[0].label)}</span>
        <span>{data.length > 2 && tick(data[Math.floor(data.length / 2)].label)}</span>
        <span>{data.length > 1 && tick(data[data.length - 1].label)}</span>
      </div>

      {/* Exact values for assistive tech. */}
      <ul className="sr-only">
        {data.map((d) => (
          <li key={d.label}>
            {tick(d.label)}: {d.value}
          </li>
        ))}
      </ul>
    </div>
  );
};
