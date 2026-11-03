interface LogoMarkProps {
  /** Rendered size in px. */
  size?: number;
  className?: string;
}

/**
 * The AlertUp mark: QR finder brackets framing an upward arrow — "scan this,
 * go that way". Both halves of the product in one glyph.
 *
 * Flat fill, not a gradient. On a monochrome palette a three-stop grey ramp
 * reads as a smudge at 30px rather than as depth, and it is the only gradient
 * left in the interface.
 */
export const LogoMark = ({ size = 36, className = "" }: LogoMarkProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
    className={className}
  >
    <rect width="40" height="40" rx="11" fill="var(--brand)" />

    {/* QR finder brackets */}
    <g
      stroke="var(--brand-ink)"
      strokeOpacity="0.5"
      strokeWidth="2.4"
      strokeLinecap="round"
      fill="none"
    >
      <path d="M10 15v-3a2 2 0 0 1 2-2h3" />
      <path d="M25 10h3a2 2 0 0 1 2 2v3" />
      <path d="M30 25v3a2 2 0 0 1-2 2h-3" />
      <path d="M15 30h-3a2 2 0 0 1-2-2v-3" />
    </g>

    {/* Direction arrow */}
    <g fill="var(--brand-ink)">
      <path
        d="M20 14.2 25.8 20.6H14.2Z"
        stroke="var(--brand-ink)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <rect x="17.7" y="22.4" width="4.6" height="4.4" rx="1.6" />
    </g>
  </svg>
);

interface LogoProps {
  size?: number;
  /** Hide the wordmark and show the mark alone (tight headers, avatars). */
  markOnly?: boolean;
  className?: string;
}

/**
 * One weight, one colour, tight tracking. The wordmark used to split "Alert"
 * and "Up" across two colours in a heavy display face, which made the busiest
 * thing in the navigation bar the part that is never clicked.
 */
export const Logo = ({ size = 34, markOnly = false, className = "" }: LogoProps) => (
  <span className={`inline-flex items-center gap-2 ${className}`}>
    <LogoMark size={size} />
    {!markOnly && (
      <span className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">
        AlertUp
      </span>
    )}
  </span>
);

export default Logo;
