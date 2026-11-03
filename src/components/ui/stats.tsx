import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/* ============================================================================
   Stat, StatRow, ScoreBar, DonutRing — the numeric surfaces.
   Numbers are set in the display serif with tabular figures, so a counting
   animation does not change the element's width mid-count.
   ========================================================================= */

export interface StatProps {
  value: ReactNode;
  caption: string;
  className?: string;
}

export const Stat = ({ value, caption, className }: StatProps) => (
  <div className={cn("flex flex-col gap-1", className)}>
    <span className="t-stat tabular-nums">{value}</span>
    <span className="t-overline text-ink-3">{caption}</span>
  </div>
);

/** 3–4 inline stats with a hairline divider between. Wraps on mobile rather
 *  than shrinking the numbers below legibility. */
export const StatRow = ({
  stats,
  className,
}: {
  stats: StatProps[];
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-wrap items-start gap-x-12 gap-y-8",
      "sm:divide-x sm:divide-line",
      className,
    )}
  >
    {stats.map((s, i) => (
      <Stat
        key={s.caption}
        {...s}
        className={cn(i > 0 && "sm:pl-12")}
      />
    ))}
  </div>
);

/* --- Score bar ----------------------------------------------------------- */

const GRADES = ["F", "D", "C", "B", "A", "A+"] as const;
export type Grade = (typeof GRADES)[number];

const GRADE_COLOR: Record<Grade, string> = {
  F: "bg-viz-f",
  D: "bg-viz-d",
  C: "bg-viz-c",
  B: "bg-viz-b",
  A: "bg-viz-a",
  "A+": "bg-viz-ap",
};

/** Segmented F→A+ bar with a marker at the current grade.
 *  The grade letter is always rendered, so colour is never the only signal. */
export const ScoreBar = ({
  grade,
  label,
  className,
}: {
  grade: Grade;
  label: string;
  className?: string;
}) => {
  const index = GRADES.indexOf(grade);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between">
        <span className="t-overline text-ink-3">{label}</span>
        <span className="t-heading-xs text-ink" aria-hidden="true">
          {grade}
        </span>
      </div>
      <div
        className="flex gap-1"
        role="meter"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={GRADES.length}
        aria-valuetext={`${label}: grade ${grade}`}
      >
        {GRADES.map((g, i) => (
          <span
            key={g}
            className={cn(
              "h-2 flex-1 rounded-sm transition-colors duration-base",
              i <= index ? GRADE_COLOR[grade] : "bg-surface-2",
            )}
          />
        ))}
      </div>
      <div className="flex justify-between" aria-hidden="true">
        {GRADES.map((g) => (
          <span
            key={g}
            className={cn(
              "text-[0.6875rem] tabular-nums",
              g === grade ? "text-ink" : "text-ink-4",
            )}
          >
            {g}
          </span>
        ))}
      </div>
    </div>
  );
};

/* --- Donut ring ---------------------------------------------------------- */

/** Donut with a 10px stroke and a large serif number in the middle.
 *  Pure SVG — no chart library for one ring. */
export const DonutRing = ({
  value,
  max = 100,
  label,
  caption,
  delta,
  size = 160,
  className,
}: {
  value: number;
  max?: number;
  label: string;
  caption?: string;
  delta?: string;
  size?: number;
  className?: string;
}) => {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));

  return (
    <figure className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${label}: ${value} of ${max}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-surface-2"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="stroke-accent transition-[stroke-dashoffset] duration-hero ease-out"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="t-stat tabular-nums" aria-hidden="true">
            {value}
          </span>
        </span>
      </div>
      <figcaption className="flex flex-col items-center gap-1">
        <span className="t-overline text-ink-3">{caption ?? label}</span>
        {delta ? <span className="text-sm text-safe-text">{delta}</span> : null}
      </figcaption>
    </figure>
  );
};
