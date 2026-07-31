import { cn } from "../../lib/cn";

/* ============================================================================
   Shared class recipes.
   Kept out of the component files so react-refresh stays happy, and so a
   <Link> can wear an identical button skin without faking a <button>.
   ========================================================================= */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "subtle"
  | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const BUTTON_BASE = cn(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
  "font-medium rounded-full select-none",
  "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
  // Press feedback that does not move neighbouring content.
  "active:scale-[0.98]",
);

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // `brand-ink` is the token paired with `brand` for AA contrast; never
  // hardcode a foreground here.
  primary: cn(
    "bg-brand text-brand-ink shadow-sm",
    "hover:bg-brand-hover hover:shadow-md",
  ),
  secondary: cn(
    "bg-surface text-ink border border-line shadow-xs",
    "hover:bg-surface-hover hover:border-line-strong",
  ),
  subtle: cn("bg-brand-subtle text-brand-text border border-brand-border", "hover:bg-brand-100"),
  ghost: cn("text-ink-muted", "hover:bg-surface-hover hover:text-ink"),
  danger: cn("bg-danger text-danger-ink shadow-sm", "hover:brightness-110"),
  link: cn(
    "text-brand-text underline underline-offset-4 decoration-brand-border rounded-sm",
    "hover:decoration-current",
  ),
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  // 44px min height — the platform touch-target floor.
  sm: "h-9 min-h-9 px-3.5 text-sm",
  md: "h-11 min-h-11 px-5 text-[0.9375rem]",
  lg: "h-13 min-h-13 px-7 text-base",
  icon: "h-11 w-11 min-h-11 p-0",
  "icon-sm": "h-9 w-9 min-h-9 p-0",
};

export const buttonStyles = ({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) =>
  cn(
    BUTTON_BASE,
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    variant === "link" && "h-auto min-h-0 px-0",
    fullWidth && "w-full",
    className,
  );

/* --- Surfaces ------------------------------------------------------------ */

export const cardStyles = ({
  interactive = false,
  className = "",
}: { interactive?: boolean; className?: string } = {}) =>
  cn(
    "rounded-2xl border border-line bg-surface shadow-sm",
    interactive &&
      cn(
        "transition-[transform,box-shadow,border-color] duration-200 ease-out",
        "hover:-translate-y-0.5 hover:shadow-lg hover:border-brand-border",
        "focus-within:-translate-y-0.5 focus-within:shadow-lg",
      ),
    className,
  );

/* --- Form controls ------------------------------------------------------- */

export const inputStyles = ({
  invalid = false,
  className = "",
}: { invalid?: boolean; className?: string } = {}) =>
  cn(
    "w-full rounded-xl border bg-surface-2 px-4 py-3 text-ink",
    // 16px min on mobile, otherwise iOS zooms the viewport on focus.
    "text-base min-h-11",
    "transition-[border-color,box-shadow,background-color] duration-200 ease-out",
    "placeholder:text-ink-subtle",
    "focus:outline-none focus:bg-surface focus:ring-2 focus:ring-ring/35",
    "disabled:opacity-55 disabled:cursor-not-allowed",
    "read-only:bg-canvas-subtle",
    invalid
      ? "border-danger focus:border-danger focus:ring-danger/30"
      : "border-line focus:border-brand",
    className,
  );

/* --- Badges -------------------------------------------------------------- */

export type BadgeTone = "neutral" | "brand" | "success" | "danger" | "warning" | "info";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-muted border-line",
  brand: "bg-brand-subtle text-brand-text border-brand-border",
  success: "bg-success-subtle text-success-text border-success-border",
  danger: "bg-danger-subtle text-danger-text border-danger-border",
  warning: "bg-warning-subtle text-warning-text border-warning-border",
  info: "bg-info-subtle text-info-text border-info-border",
};

export const badgeStyles = ({
  tone = "neutral",
  className = "",
}: { tone?: BadgeTone; className?: string } = {}) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
    "text-xs font-medium leading-none",
    BADGE_TONES[tone],
    className,
  );
