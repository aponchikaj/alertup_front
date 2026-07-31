import type { ReactNode, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Rendered size in px. Defaults to 1em so icons track the text they sit next to. */
  size?: number | string;
  /**
   * Accessible name. Leave undefined for decorative icons — they are then
   * hidden from assistive tech, which is correct when adjacent text already
   * carries the meaning.
   */
  title?: string;
}

/**
 * Shared chassis for every icon in the app: one grid (24), one stroke width
 * (1.75), one set of caps and joins. Consistency here is most of what makes an
 * icon set read as designed rather than assembled.
 */
export const Icon = ({
  size = "1em",
  title,
  children,
  ...props
}: IconProps & { children: ReactNode }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    role={title ? "img" : undefined}
    aria-hidden={title ? undefined : true}
    focusable="false"
    {...props}
  >
    {title ? <title>{title}</title> : null}
    {children}
  </svg>
);

export default Icon;
