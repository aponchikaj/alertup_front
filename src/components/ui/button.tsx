import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { buttonStyles, type ButtonSize, type ButtonVariant } from "./styles";
import { SpinnerIcon } from "./icons";

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
}

export interface ButtonProps
  extends CommonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {
  /** Swaps the label for a spinner and blocks repeat submits. */
  loading?: boolean;
  /** Announced while `loading`, so the change isn't silent to screen readers. */
  loadingLabel?: string;
}

export const Button = ({
  variant,
  size,
  fullWidth,
  className,
  loading = false,
  loadingLabel = "Working…",
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) => (
  <button
    type={type}
    className={buttonStyles({ variant, size, fullWidth, className })}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...props}
  >
    {loading ? (
      <>
        <SpinnerIcon size={18} />
        <span>{loadingLabel}</span>
      </>
    ) : (
      children
    )}
  </button>
);

export interface ButtonLinkProps
  extends CommonProps,
    Omit<LinkProps, "className" | "children"> {}

/** Router link that wears the button skin. Stays an anchor, so middle-click,
 *  "open in new tab" and copy-link all keep working. */
export const ButtonLink = ({
  variant,
  size,
  fullWidth,
  className,
  children,
  ...props
}: ButtonLinkProps) => (
  <Link className={buttonStyles({ variant, size, fullWidth, className })} {...props}>
    {children}
  </Link>
);

export default Button;
