import type { ButtonHTMLAttributes, ReactNode } from "react";
import { chipStyles } from "./styles";

export interface ChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  selected?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Selectable pill. Renders a real <button> so it is keyboard reachable and
 *  announces its pressed state, rather than a div with an onClick. */
export const Chip = ({ selected, icon, className, children, ...props }: ChipProps) => (
  <button
    type="button"
    aria-pressed={selected}
    className={chipStyles({ selected, className })}
    {...props}
  >
    {icon}
    {children}
  </button>
);

/** Non-interactive variant — a label, not a control. */
export const ChipStatic = ({
  icon,
  className,
  children,
}: {
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <span className={chipStyles({ className })}>
    {icon}
    {children}
  </span>
);

export default Chip;
