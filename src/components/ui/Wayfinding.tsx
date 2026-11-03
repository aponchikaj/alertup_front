import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/* ============================================================================
   FloorSwitcher, RouteStepList, IconTiles — the visitor-facing wayfinding
   surfaces. All three are used at arm's length, one-handed, sometimes under
   stress, so targets are large and state is never carried by colour alone.
   ========================================================================= */

export interface FloorOption {
  id: string;
  /** Short label as printed in the building: "B1", "G", "1", "2". */
  label: string;
}

/** Vertical segmented control. Vertical because floors are vertical — the
 *  control is a small picture of the building. */
export const FloorSwitcher = ({
  floors,
  current,
  onChange,
  className,
}: {
  floors: FloorOption[];
  current: string;
  onChange: (id: string) => void;
  className?: string;
}) => (
  <div
    role="radiogroup"
    aria-label="Floor"
    className={cn(
      "inline-flex flex-col gap-1 rounded-pill border border-line bg-surface p-1",
      className,
    )}
  >
    {floors.map((f) => {
      const active = f.id === current;
      return (
        <button
          key={f.id}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(f.id)}
          className={cn(
            "size-11 rounded-pill text-sm font-medium tabular-nums",
            "transition-[background-color,color] duration-fast ease-out",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            active
              ? "bg-accent text-accent-ink"
              : "text-ink-2 hover:bg-surface-2",
          )}
        >
          {f.label}
        </button>
      );
    })}
  </div>
);

/* --- Route steps --------------------------------------------------------- */

export interface RouteStep {
  id: string;
  /** "Walk to the end of the corridor", "Take the lift to floor 3". */
  instruction: string;
  icon: ReactNode;
  distance?: string;
  floor?: string;
}

/**
 * Numbered steps with a coloured left rail on the current step. In an
 * emergency the rail turns green, because the route token flips — the
 * component does not know or care which mode it is in.
 */
export const RouteStepList = ({
  steps,
  currentIndex = 0,
  className,
}: {
  steps: RouteStep[];
  currentIndex?: number;
  className?: string;
}) => (
  <ol className={cn("flex flex-col", className)}>
    {steps.map((step, i) => {
      const current = i === currentIndex;
      const done = i < currentIndex;
      return (
        <li
          key={step.id}
          aria-current={current ? "step" : undefined}
          className={cn(
            "flex gap-4 border-l-2 py-4 pl-4 pr-2",
            current ? "border-route bg-surface-2" : "border-line",
            done && "opacity-55",
          )}
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-pill",
              current ? "bg-route text-accent-ink" : "bg-surface-2 text-ink-2",
            )}
          >
            {step.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-ink">
              {/* The step number is text, not a ::before, so screen readers
                  and copy-paste both get it. */}
              <span className="sr-only">Step {i + 1}: </span>
              {step.instruction}
            </span>
            {(step.distance || step.floor) && (
              <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-ink-3">
                {step.distance ? <span className="tabular-nums">{step.distance}</span> : null}
                {step.floor ? <span>Floor {step.floor}</span> : null}
              </span>
            )}
          </span>
        </li>
      );
    })}
  </ol>
);

/* --- Icon tiles ---------------------------------------------------------- */

export interface IconTile {
  id: string;
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
}

/** 3-column grid of large tiles — the visitor home. Two taps from scan to
 *  exit means this grid has to be the second tap, so the targets are 88px. */
export const IconTiles = ({
  tiles,
  className,
}: {
  tiles: IconTile[];
  className?: string;
}) => (
  <ul className={cn("grid grid-cols-3 gap-3", className)}>
    {tiles.map((t) => (
      <li key={t.id}>
        <button
          type="button"
          onClick={t.onClick}
          className={cn(
            "flex aspect-square w-full flex-col items-center justify-center gap-2 p-2",
            "rounded-lg border border-line bg-surface text-ink",
            "transition-[border-color,transform] duration-fast ease-out",
            "hover:-translate-y-0.5 hover:border-line-strong",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          )}
        >
          <span className="text-ink-2">{t.icon}</span>
          <span className="text-center text-sm font-medium leading-tight">{t.label}</span>
        </button>
      </li>
    ))}
  </ul>
);
