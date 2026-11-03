import type { ReactNode } from "react";

/* ============================================================================
   ISO 7010 safety pictograms — the EMERGENCY register.
   ----------------------------------------------------------------------------
   Deliberately a separate module from icons.tsx. The two sets must never be
   used interchangeably: an ISO 7010 running-man in a settings menu dilutes the
   signal, and a generic triangle in an evacuation banner fails ISO 23601,
   which requires conformant pictograms on evacuation plans.

   GEOMETRY CARRIES SEVERITY, because colour cannot. Measured separation between
   High-Vis Safety Red and the warning amber is 84.3 under deuteranopia and 63.6
   under tritanopia — close enough that colour alone is not a safe signal. So:

     octagon   = critical / evacuate now
     triangle  = warning / prepare
     rectangle = safe condition (exit, assembly point)
     circle    = mandatory action

   `title` is required, not optional. A safety pictogram with no accessible
   name is a defect, not a styling choice.
   ========================================================================= */

export interface SafetyIconProps {
  /** Announced to assistive tech. Pass "" only when adjacent text already
   *  names the state and the container is itself a live region. */
  title: string;
  size?: number;
  className?: string;
}

const Svg = ({
  title,
  size = 24,
  className,
  children,
}: SafetyIconProps & { children: ReactNode }) => {
  const decorative = title === "";
  return (
    <svg
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {!decorative && <title>{title}</title>}
      {children}
    </svg>
  );
};

/** Critical / evacuate. Octagon — the one shape reserved for "stop, now". */
export const EvacuateIcon = (p: SafetyIconProps) => (
  <Svg {...p}>
    <polygon
      points="8,1.5 16,1.5 22.5,8 22.5,16 16,22.5 8,22.5 1.5,16 1.5,8"
      fill="currentColor"
      opacity="0.14"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    <path d="M12 6.5v7" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    <circle cx="12" cy="17.25" r="1.25" fill="currentColor" />
  </Svg>
);

/** ISO 7010 W001 — general warning. Triangle. */
export const WarningIcon = (p: SafetyIconProps) => (
  <Svg {...p}>
    <polygon
      points="12,2 23,21 1,21"
      fill="currentColor"
      opacity="0.14"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    <path d="M12 9v5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    <circle cx="12" cy="17.5" r="1.15" fill="currentColor" />
  </Svg>
);

/** ISO 7010 E002 family — running figure through a door. Safe condition. */
export const EmergencyExitIcon = (p: SafetyIconProps) => (
  <Svg {...p}>
    <rect
      x="1"
      y="2"
      width="22"
      height="20"
      rx="1.5"
      fill="currentColor"
      opacity="0.14"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="M15 4.5h5.5v15H15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <circle cx="8" cy="6.75" r="1.5" fill="currentColor" />
    <path
      d="M8 9.25 6 13.5l2.4 1.9.6 3.85M8 9.25l2.9 1.9 2.4-.4M6 13.5l-2.3 1.4"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** ISO 7010 E007 — evacuation assembly point. Four arrows converging. */
export const AssemblyPointIcon = (p: SafetyIconProps) => (
  <Svg {...p}>
    <rect
      x="1"
      y="2"
      width="22"
      height="20"
      rx="1.5"
      fill="currentColor"
      opacity="0.14"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M12 12 6.5 6.5m0 0v3m0-3h3M12 12l5.5-5.5m0 0h-3m3 0v3M12 12l-5.5 5.5m0 0h3m-3 0v-3M12 12l5.5 5.5m0 0v-3m0 3h-3"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** ISO 7010 M-series — mandatory action. Circle. */
export const MandatoryIcon = (p: SafetyIconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.14" />
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" />
    <path
      d="m7.5 12.25 3 3 6-6.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** ISO 7010 F001 — fire extinguisher. Fire-equipment red. */
export const FireExtinguisherIcon = (p: SafetyIconProps) => (
  <Svg {...p}>
    <rect
      x="1"
      y="2"
      width="22"
      height="20"
      rx="1.5"
      fill="currentColor"
      opacity="0.14"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path
      d="M9.5 9h5v11h-5zM12 9V6.75M12 6.75h3.75L17 9M10 5.5h4"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
