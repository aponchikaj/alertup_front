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
  /** iOS `filled` — bg tint, white label. The one saturated control per screen. */
  | "primary"
  /** iOS `tinted` — 15% tint wash, tint text. */
  | "tinted"
  /** iOS `gray` — fill bg, label text. Cancel, secondary. */
  | "gray"
  /** iOS `plain` — text only, tint. */
  | "plain"
  /** 34px circle / pill on glass, for toolbars and nav bars. */
  | "glass"
  | "safe"
  | "emergency"
  | "destructive"
  /** @deprecated aliases kept so existing call sites compile. */
  | "secondary"
  | "ghost"
  | "danger"
  | "subtle"
  | "link";

export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const BUTTON_BASE = cn(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
  // headline: 17px / 600. Buttons are labels, not headings.
  "text-[17px] font-semibold tracking-[-0.41px] select-none",
  "transition-[background-color,color,opacity,transform]",
  "duration-snappy ease-snappy",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  // iOS disabled: fill bg + tertiary label, never a ghosted primary.
  "disabled:pointer-events-none disabled:cursor-not-allowed",
  // iOS press: opacity .8 + scale .97. Transform only — never a layout property.
  "active:opacity-80 active:scale-[0.97]",
);

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // `accent-ink` is the token paired with `accent` for AA contrast; never
  // hardcode a foreground here. In light the fill is #0066D6 (white 5.42:1);
  // the stock #007AFF is 4.02:1 and is reserved for icons, rings and the route.
  primary: cn("bg-accent text-accent-ink", "disabled:bg-fill disabled:text-fg-tertiary"),
  tinted: cn("bg-accent-wash text-accent-text", "disabled:bg-fill disabled:text-fg-tertiary"),
  gray: cn("bg-fill text-fg", "disabled:text-fg-tertiary"),
  plain: cn("bg-transparent text-accent-text", "disabled:text-fg-tertiary"),
  glass: cn("glass text-fg", "disabled:text-fg-tertiary"),
  secondary: cn("bg-fill text-fg", "disabled:text-fg-tertiary"),
  ghost: cn("bg-transparent text-accent-text", "disabled:text-fg-tertiary"),
  subtle: cn("bg-accent-wash text-accent-text", "disabled:text-fg-tertiary"),
  /* "Start evacuation route" / "Mark as safe". Green because people move
     toward green in a crisis — this is the one place the colour is load-bearing
     rather than decorative. */
  safe: cn("bg-safe text-safe-ink", "disabled:bg-fill disabled:text-fg-tertiary"),
  /* "Declare emergency". Amber, never red: red reads as stop and triggers
     panic, amber reads as act-now and stays the most visible hue at distance.
     ALWAYS behind a hold-to-confirm modal — see ConfirmDialog. */
  emergency: cn("bg-alarm text-alarm-ink", "focus-visible:outline-alarm"),
  /* Outline by default, filling only on hover — a page full of solid red
     buttons trains people to ignore red. */
  /* iOS destructive is `plain` red by default. Filled red exists only inside
     a confirmation sheet — pass `square` + className there. */
  destructive: cn("bg-transparent text-destructive-text"),
  danger: cn("bg-transparent text-destructive-text"),
  link: cn("bg-transparent text-accent-text underline underline-offset-2"),
};

/* 34 small (toolbars) / 44 regular / 50 prominent (visitor CTAs). */
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-[34px] min-h-[34px] px-3.5 text-[15px] tracking-[-0.24px]",
  md: "h-11 min-h-11 px-5",
  lg: "h-[50px] min-h-[50px] px-6",
  icon: "h-11 w-11 min-h-11 p-0",
  "icon-sm": "h-[34px] w-[34px] min-h-[34px] p-0",
};

/* Regular buttons take r-md (14). Prominent CTAs, glass toolbar buttons and
   icon buttons are pills. */
const PILL_ALWAYS: ButtonVariant[] = ["glass"];

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
    square
      ? "rounded-md"
      : PILL_ALWAYS.includes(variant) || size === "lg" || size.startsWith("icon")
        ? "rounded-pill"
        : "rounded-md",
    (variant === "link" || variant === "plain") && "h-auto min-h-0 px-0",
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
    // Inset grouped card: white on the gray canvas does the work in light;
    // dark adds a 0.5px hairline via --card-edge. No border, no drop shadow.
    "card-inset",
    interactive &&
      cn(
        "transition-[transform,opacity] duration-snappy ease-snappy",
        "active:scale-[0.99] active:opacity-90",
      ),
    className,
  );

/* --- Form controls ------------------------------------------------------- */

export const inputStyles = ({
  invalid = false,
  className = "",
}: { invalid?: boolean; className?: string } = {}) =>
  cn(
    // iOS text field: fill background, no border, r-sm. 44px and 17px text —
    // anything under 16px makes iOS zoom the viewport on focus.
    "w-full rounded-sm bg-fill-tertiary px-3 text-fg",
    "h-11 min-h-11 text-[17px] tracking-[-0.41px]",
    "transition-[box-shadow,background-color] duration-snappy ease-snappy",
    "placeholder:text-fg-secondary",
    // Solid 2px ring: the spec's .35-alpha ring measured 1.60:1.
    "focus:outline-none focus:ring-2 focus:ring-ring",
    "disabled:text-fg-tertiary disabled:cursor-not-allowed",
    "read-only:bg-fill-secondary",
    invalid && "ring-2 ring-destructive-text focus:ring-destructive-text",
    className,
  );

/** The single most important control in the product: a stressed person's
 *  first interaction after scanning. Bigger than anything else on the screen. */
export const searchFieldStyles = ({ className = "" }: { className?: string } = {}) =>
  cn(
    "w-full rounded-pill bg-fill-tertiary",
    "h-14 pl-12 pr-4 text-[17px] tracking-[-0.41px] text-fg",
    "transition-[box-shadow,background-color] duration-snappy ease-snappy",
    "placeholder:text-fg-secondary",
    "focus:outline-none focus:ring-2 focus:ring-ring",
    className,
  );

/* --- Chips --------------------------------------------------------------- */

export const chipStyles = ({
  selected = false,
  className = "",
}: { selected?: boolean; className?: string } = {}) =>
  cn(
    "inline-flex h-9 items-center gap-2 rounded-pill px-4",
    "text-[15px] font-semibold tracking-[-0.24px]",
    "transition-[background-color,color,transform] duration-snappy ease-snappy",
    "active:scale-[0.97]",
    selected ? "bg-accent-wash text-accent-text" : "bg-fill text-fg",
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
  neutral: "bg-fill text-fg-secondary",
  brand: "bg-accent-wash text-accent-text",
  safe: "bg-safe-subtle text-safe-text",
  alarm: "bg-alarm-subtle text-alarm-text",
  destructive: "bg-danger-subtle text-destructive-text",
  success: "bg-safe-subtle text-safe-text",
  warning: "bg-alarm-subtle text-alarm-text",
  danger: "bg-danger-subtle text-destructive-text",
  info: "bg-accent-wash text-accent-text",
};

export const badgeStyles = ({
  tone = "neutral",
  className = "",
}: { tone?: BadgeTone; className?: string } = {}) =>
  cn(
    // Capsule, caption1 at 600. Sentence case — Apple does not shout.
    "inline-flex h-[22px] items-center gap-1 rounded-pill px-2",
    "text-[12px] font-semibold leading-none",
    BADGE_TONES[tone],
    className,
  );
