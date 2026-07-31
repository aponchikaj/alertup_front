import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { cardStyles } from "./styles";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  children?: ReactNode;
}

export const Card = ({ interactive, className, children, ...props }: CardProps) => (
  <div className={cardStyles({ interactive, className })} {...props}>
    {children}
  </div>
);

export const CardHeader = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5 p-6 pb-0", className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-lg font-semibold text-ink", className)} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-ink-muted", className)} {...props}>
    {children}
  </p>
);

export const CardBody = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6", className)} {...props}>
    {children}
  </div>
);

export const CardFooter = ({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex items-center gap-3 border-t border-line p-6", className)}
    {...props}
  >
    {children}
  </div>
);

export default Card;
