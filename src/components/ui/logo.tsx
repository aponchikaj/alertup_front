import { useId } from "react";

interface LogoMarkProps {
  /** Rendered size in px. */
  size?: number;
  className?: string;
}

/**
 * The AlertUp mark: QR finder brackets framing an upward escape arrow —
 * "scan this, go that way". Both halves of the product in one glyph.
 *
 * Gradient ids are generated per instance; a hardcoded id collides as soon as
 * the mark appears twice on a page (header + footer) and the second one
 * renders unfilled in Safari.
 */
export const LogoMark = ({ size = 36, className = "" }: LogoMarkProps) => {
  const gradientId = useId();

  return (
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
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-300)" />
          <stop offset="0.55" stopColor="var(--brand-400)" />
          <stop offset="1" stopColor="var(--brand-600)" />
        </linearGradient>
      </defs>

      <rect width="40" height="40" rx="12" fill={`url(#${gradientId})`} />

      {/* QR finder brackets */}
      <g
        stroke="var(--brand-ink)"
        strokeOpacity="0.45"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M10 15v-3a2 2 0 0 1 2-2h3" />
        <path d="M25 10h3a2 2 0 0 1 2 2v3" />
        <path d="M30 25v3a2 2 0 0 1-2 2h-3" />
        <path d="M15 30h-3a2 2 0 0 1-2-2v-3" />
      </g>

      {/* Escape arrow */}
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
};

interface LogoProps {
  size?: number;
  /** Hide the wordmark and show the mark alone (tight headers, avatars). */
  markOnly?: boolean;
  className?: string;
}

export const Logo = ({ size = 34, markOnly = false, className = "" }: LogoProps) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <LogoMark size={size} />
    {!markOnly && (
      <span className="font-display text-xl font-semibold tracking-tight text-ink">
        Alert<span className="text-brand-text">Up</span>
      </span>
    )}
  </span>
);

export default Logo;
