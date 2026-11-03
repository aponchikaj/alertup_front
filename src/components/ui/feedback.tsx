import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { badgeStyles, type BadgeTone } from "./styles";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  XCircleIcon,
} from "./icons";

/* --- Badge --------------------------------------------------------------- */

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children?: ReactNode;
}

export const Badge = ({ tone, className, children, ...props }: BadgeProps) => (
  <span className={badgeStyles({ tone, className })} {...props}>
    {children}
  </span>
);

/* --- Alert --------------------------------------------------------------- */

export type AlertTone = "info" | "success" | "warning" | "danger";

const ALERT_TONES: Record<AlertTone, { wrap: string; icon: typeof InfoIcon }> = {
  info: {
    wrap: "bg-info-subtle border-info-border text-info-text",
    icon: InfoIcon,
  },
  success: {
    wrap: "bg-success-subtle border-success-border text-success-text",
    icon: CheckCircleIcon,
  },
  warning: {
    wrap: "bg-warning-subtle border-warning-border text-warning-text",
    icon: AlertTriangleIcon,
  },
  danger: {
    wrap: "bg-danger-subtle border-danger-border text-danger-text",
    icon: XCircleIcon,
  },
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  title?: string;
  /**
   * Whether this Alert is its own live region. Default true.
   *
   * Set it false for two cases, and only those:
   *  - standing instructional copy that happens to want the Alert's look but
   *    never changes ("Tap connections on the map…"), which a live region
   *    would make compete with the real status message beside it;
   *  - an Alert rendered INSIDE a live region the caller already owns, where
   *    nesting a second one is undefined behaviour in most screen readers.
   */
  live?: boolean;
  children?: ReactNode;
}

/**
 * Status message. The icon carries the meaning alongside the colour, so the
 * state survives greyscale and colour-blind viewing.
 */
export const Alert = ({
  tone = "info",
  title,
  live = true,
  className,
  children,
  ...props
}: AlertProps) => {
  const { wrap, icon: ToneIcon } = ALERT_TONES[tone];

  return (
    <div
      role={live ? (tone === "danger" ? "alert" : "status") : undefined}
      aria-live={live ? (tone === "danger" ? "assertive" : "polite") : undefined}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        wrap,
        className,
      )}
      {...props}
    >
      <ToneIcon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
};

/* --- Skeleton ------------------------------------------------------------ */

export const Skeleton = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    aria-hidden="true"
    className={cn("skeleton rounded-lg", className)}
    {...props}
  />
);

/* --- Empty state --------------------------------------------------------- */

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-3 rounded-lg",
      "border border-dashed border-line bg-surface-2 px-6 py-14 text-center",
      className,
    )}
  >
    {icon && (
      <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-subtle text-brand-text">
        {icon}
      </span>
    )}
    <h3 className="text-base font-semibold text-ink">{title}</h3>
    {description && (
      <p className="max-w-sm text-sm text-ink-muted">{description}</p>
    )}
    {action && <div className="mt-2">{action}</div>}
  </div>
);
