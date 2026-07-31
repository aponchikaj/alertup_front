import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** `prose` narrows the measure to ~70 characters for long-form reading. */
  width?: "prose" | "default" | "wide";
}

const WIDTHS = {
  prose: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
} as const;

export const Container = ({
  width = "default",
  className,
  children,
  ...props
}: ContainerProps) => (
  <div
    className={cn("mx-auto w-full px-5 sm:px-6 lg:px-8", WIDTHS[width], className)}
    {...props}
  >
    {children}
  </div>
);

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** Alternating tone lets adjacent sections separate without a hard rule. */
  tone?: "canvas" | "subtle" | "surface";
}

const TONES = {
  canvas: "bg-canvas",
  subtle: "bg-canvas-subtle",
  surface: "bg-surface",
} as const;

export const Section = ({
  tone = "canvas",
  className,
  children,
  ...props
}: SectionProps) => (
  <section className={cn("py-16 sm:py-20 lg:py-24", TONES[tone], className)} {...props}>
    {children}
  </section>
);

export interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
}

export const SectionHeading = ({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionHeadingProps) => (
  <div
    className={cn(
      "flex flex-col gap-4",
      align === "center" ? "items-center text-center" : "items-start text-left",
      className,
    )}
  >
    {eyebrow && (
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-text">
        {eyebrow}
      </span>
    )}
    <h2 className="text-3xl font-semibold text-ink sm:text-4xl">{title}</h2>
    {description && (
      <p
        className={cn(
          "text-base leading-relaxed text-ink-muted sm:text-lg",
          align === "center" ? "max-w-2xl" : "max-w-xl",
        )}
      >
        {description}
      </p>
    )}
  </div>
);

/**
 * Top-of-page heading for authenticated screens. Also owns the offset that
 * clears the fixed header, so no page has to remember to add it.
 */
export const PageHeader = ({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-col gap-5 border-b border-line pb-8",
      "sm:flex-row sm:items-end sm:justify-between",
      className,
    )}
  >
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
      {description && (
        <p className="max-w-2xl text-base text-ink-muted">{description}</p>
      )}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
  </div>
);

/** Standard shell for every routed page: clears the fixed navbar and sets the
 *  page background, so individual pages stop hardcoding both. Renders a div —
 *  App.tsx already owns the single <main id="main"> landmark. */
export const PageShell = ({
  className,
  children,
  width = "default",
  ...props
}: ContainerProps) => (
  <div
    className={cn("min-h-[70vh] bg-canvas pb-20 pt-28 sm:pt-32", className)}
    {...props}
  >
    <Container width={width}>{children}</Container>
  </div>
);
