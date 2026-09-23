import { cn } from "../../lib/cn";

/* ============================================================================
   Shared class recipes.
   Kept out of the component files so react-refresh stays happy, and so a
   <Link> can wear an identical button skin without faking a <button>.

   Two radius languages, on purpose:
     PILL  — primary actions and everything on mobile. Reads as "press me".
     r-md  — secondary controls inside forms and tables, where a row of pills
             would look like confetti.
   ========================================================================= */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "safe"
  | "emergency"
  | "destructive"
  /** @deprecated use `destructive` — kept so existing call sites compile. */
  | "danger"
  | "subtle"
  | "link";

export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const BUTTON_BASE = cn(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
  "font-medium select-none",
  "transition-[background-color,border-color,color,box-shadow,transform]",
  "duration-base ease-out",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  "disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed",
  // Press feedback that does not move neighbouring content.
  "active:scale-[0.98]",
);

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // `accent-ink` is the token paired with `accent` for AA contrast; never
  // hardcode a foreground here.
  primary: cn(
    "bg-accent text-accent-ink",
    "hover:bg-accent-hover active:bg-accent-press",
  ),
  secondary: cn(
    "bg-surface text-ink border border-line-strong",
    "hover:bg-surface-2 hover:border-line-control",
  ),
  ghost: cn("text-ink-2 bg-transparent", "hover:bg-surface-2 hover:text-ink"),
  subtle: cn(
    "bg-accent-subtle text-accent-text border border-brand-100",
    "hover:bg-brand-100",
  ),
  /* "Start evacuation route" / "Mark as safe". Green because people move
     toward green in a crisis — this is the one place the colour is load-bearing
     rather than decorative. */
  safe: cn("bg-safe text-safe-ink", "hover:brightness-110"),
  /* "Declare emergency". Amber, never red: red reads as stop and triggers
     panic, amber reads as act-now and stays the most visible hue at distance.
     ALWAYS behind a hold-to-confirm modal — see ConfirmDialog. */
  emergency: cn(
    "bg-alarm text-alarm-ink font-semibold",
    "hover:brightness-105 focus-visible:outline-alarm",
  ),
  /* Outline by default, filling only on hover — a page full of solid red
     buttons trains people to ignore red. */
  destructive: cn(
    "bg-transparent text-destructive-text border border-destructive",
    "hover:bg-destructive hover:text-destructive-ink",
  ),
  danger: cn(
    "bg-transparent text-destructive-text border border-destructive",
    "hover:bg-destructive hover:text-destructive-ink",
  ),
  link: cn(
    "text-accent-text underline underline-offset-4 decoration-1",
    "hover:decoration-2",
  ),
};

/* 36 / 44 / 52. md is the default because 44px is the platform touch target. */
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 min-h-9 px-4 text-sm",
  md: "h-11 min-h-11 px-5 text-[0.9375rem]",
  lg: "h-13 min-h-13 px-7 text-base",
  icon: "h-11 w-11 min-h-11 p-0",
  "icon-sm": "h-9 w-9 min-h-9 p-0",
};

/** Secondary controls inside forms and tables take the tighter radius. */
const SQUARE_VARIANTS: ButtonVariant[] = ["secondary", "ghost", "destructive", "danger"];

export const buttonStyles = ({
  variant = "primary",
  size = "md",
  fullWidth = false,
  /** Force the tighter radius on a variant that would otherwise be a pill. */
  square = false,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  square?: boolean;
  className?: string;
} = {}) =>
  cn(
    BUTTON_BASE,
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    square || SQUARE_VARIANTS.includes(variant) ? "rounded-md" : "rounded-pill",
    variant === "link" && "h-auto min-h-0 rounded-sm px-0",
    // A half-width evacuate button is a bug, not a layout choice.
    (fullWidth || variant === "emergency") && "w-full",
    className,
  );

/* --- Surfaces ------------------------------------------------------------
   Depth comes from surface contrast and a 1px border, not from shadows.
   Static cards never carry one. */

export const cardStyles = ({
  interactive = false,
  className = "",
}: { interactive?: boolean; className?: string } = {}) =>
  cn(
    "rounded-lg border border-line bg-surface",
    interactive &&
      cn(
        "transition-[transform,border-color] duration-base ease-out",
        "hover:-translate-y-0.5 hover:border-line-strong",
        "focus-within:-translate-y-0.5 focus-within:border-line-strong",
      ),
    className,
  );

/* --- Form controls ------------------------------------------------------- */

export const inputStyles = ({
  invalid = false,
  className = "",
}: { invalid?: boolean; className?: string } = {}) =>
  cn(
    "w-full rounded-md border bg-surface px-3.5 text-ink",
    // 44px, and 16px text — anything smaller makes iOS zoom the viewport on
    // focus, which on a phone reads as the page breaking.
    "h-11 min-h-11 text-base",
    "transition-[border-color,box-shadow] duration-base ease-out",
    "placeholder:text-ink-3",
    "focus:outline-none focus:border-accent focus:shadow-[var(--glow-brand)]",
    "disabled:bg-surface-2 disabled:text-ink-4 disabled:cursor-not-allowed",
    "read-only:bg-surface-2",
    invalid
      ? "border-destructive focus:border-destructive"
      // --border is 1.21:1. Decorative rules may use it; a border that IS the
      // control may not (WCAG 1.4.11 wants 3:1).
      : "border-line-control",
    className,
  );

/** The single most important control in the product: a stressed person's
 *  first interaction after scanning. Bigger than anything else on the screen. */
export const searchFieldStyles = ({ className = "" }: { className?: string } = {}) =>
  cn(
    "w-full rounded-pill border border-line-control bg-surface",
    "h-14 pl-12 pr-4 text-[1.125rem] text-ink",
    "transition-[border-color,box-shadow] duration-base ease-out",
    "placeholder:text-ink-3",
    "focus:outline-none focus:border-accent focus:shadow-[var(--glow-brand)]",
    className,
  );

/* --- Chips --------------------------------------------------------------- */

export const chipStyles = ({
  selected = false,
  className = "",
}: { selected?: boolean; className?: string } = {}) =>
  cn(
    "inline-flex h-9 items-center gap-2 rounded-pill border px-4",
    "text-sm font-medium",
    "transition-[background-color,border-color,transform] duration-fast ease-out",
    selected
      ? "border-brand-300 bg-brand-50 text-accent-text"
      : "border-line-strong bg-surface text-ink-2 hover:-translate-y-px hover:border-line-control",
    className,
  );

/* --- Badges -------------------------------------------------------------- */

export type BadgeTone =
  | "neutral"
  | "brand"
  | "safe"
  | "alarm"
  | "destructive"
  /** @deprecated aliases kept so existing call sites compile. */
  | "success"
  | "warning"
  | "danger"
  | "info";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-3 border-line-strong",
  brand: "bg-brand-50 text-accent-text border-brand-100",
  safe: "bg-safe-subtle text-safe-text border-exit-300",
  alarm: "bg-alarm-subtle text-alarm-text border-signal-700",
  destructive: "bg-danger-subtle text-destructive-text border-danger-border",
  success: "bg-safe-subtle text-safe-text border-exit-300",
  warning: "bg-alarm-subtle text-alarm-text border-signal-700",
  danger: "bg-danger-subtle text-destructive-text border-danger-border",
  info: "bg-brand-50 text-accent-text border-brand-100",
};

export const badgeStyles = ({
  tone = "neutral",
  className = "",
}: { tone?: BadgeTone; className?: string } = {}) =>
  cn(
    "inline-flex h-[22px] items-center gap-1.5 rounded-sm border px-2",
    "text-[0.6875rem] font-medium uppercase leading-none tracking-[0.08em]",
    BADGE_TONES[tone],
    className,
  );
