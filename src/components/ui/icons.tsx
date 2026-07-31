import { Icon, type IconProps } from "./icon";

/* ============================================================================
   AlertUp icon set
   ----------------------------------------------------------------------------
   Outline family, 24px grid, 1.75 stroke, currentColor. Replaces the raster
   PNGs (defence / treasure-map / smartphone / settings / refresh / print /
   report / click), which could not be themed, went blurry on retina and
   carried three different visual languages between them.
   ========================================================================= */

/* --- Navigation & chrome ------------------------------------------------- */

export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5m0 0 7 7m-7-7 7-7" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14m0 0-7-7m7 7-7 7" />
  </Icon>
);

export const ArrowUpRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Icon>
);

export const ExternalLinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 3h6v6M10 14 21 3" />
    <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
  </Icon>
);

/* --- Theme --------------------------------------------------------------- */

export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </Icon>
);

export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
  </Icon>
);

export const MonitorIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2" y="4" width="20" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Icon>
);

/* --- Product: safety & wayfinding ---------------------------------------- */

export const QrCodeIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M14 14h3v3h-3zM20 14h1M14 20h3M20 17v4" />
  </Icon>
);

export const ScanIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
    <path d="M3 12h18" />
  </Icon>
);

/** Evacuation route: a path that turns a corner and exits with an arrow. */
export const RouteIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5.5" cy="18.5" r="2.5" />
    <path d="M5.5 16V9a3 3 0 0 1 3-3h6" />
    <path d="m11.5 3 3 3-3 3" />
    <path d="M18.5 10v4.5a3 3 0 0 1-3 3H10" />
  </Icon>
);

export const ExitDoorIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h8" />
    <path d="m14 16 4-4-4-4M18 12h-7" />
  </Icon>
);

export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2.5 4.5 5.6v6.1c0 4.6 3.1 8.9 7.5 10.3 4.4-1.4 7.5-5.7 7.5-10.3V5.6L12 2.5Z" />
  </Icon>
);

export const ShieldCheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2.5 4.5 5.6v6.1c0 4.6 3.1 8.9 7.5 10.3 4.4-1.4 7.5-5.7 7.5-10.3V5.6L12 2.5Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Icon>
);

export const MapIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" />
    <path d="M9 4v13M15 6.5v13" />
  </Icon>
);

export const MapPinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icon>
);

export const BuildingIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
    <path d="M16 9h2a2 2 0 0 1 2 2v10M2 21h20" />
    <path d="M8 7h1.5M8 11h1.5M8 15h1.5M12.5 7H14M12.5 11H14M12.5 15H14M10 21v-3h2v3" />
  </Icon>
);

export const LayersIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 2 9 5-9 5-9-5 9-5Z" />
    <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
  </Icon>
);

export const AlertTriangleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4.5M12 17.5h.01" />
  </Icon>
);

export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5" />
    <path d="M13.7 20a2 2 0 0 1-3.4 0" />
  </Icon>
);

export const SmartphoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="2" width="12" height="20" rx="2.5" />
    <path d="M11 18.5h2" />
  </Icon>
);

/* --- Status -------------------------------------------------------------- */

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
);

export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.25" />
    <path d="m8.25 12.25 2.5 2.5 5-5.5" />
  </Icon>
);

export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.25" />
    <path d="M12 11v5M12 7.75h.01" />
  </Icon>
);

export const XCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.25" />
    <path d="m15 9-6 6M9 9l6 6" />
  </Icon>
);

export const SpinnerIcon = ({ className = "", ...p }: IconProps) => (
  <Icon className={`animate-spin ${className}`} {...p}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </Icon>
);

/* --- Actions & account --------------------------------------------------- */

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 8.9a1.6 1.6 0 0 0-.33-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 8.87 4.6H9a1.6 1.6 0 0 0 1-1.47V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.33 1.77V9a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </Icon>
);

export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="3.75" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Icon>
);

export const LogOutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 16 4-4-4-4M20 12H10" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 6h17M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
    <path d="M18.5 6 18 19.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5L5.5 6M10 10.5v6M14 10.5v6" />
  </Icon>
);

/** Expand to fullscreen — four corners pointing out. */
export const MaximizeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3.5H4.5a1 1 0 0 0-1 1V8M16 3.5h3.5a1 1 0 0 1 1 1V8M8 20.5H4.5a1 1 0 0 1-1-1V16M16 20.5h3.5a1 1 0 0 0 1-1V16" />
  </Icon>
);

/** Leave fullscreen — four corners pointing in. */
export const MinimizeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 8H7a1 1 0 0 0 1-1V3.5M20.5 8H17a1 1 0 0 1-1-1V3.5M3.5 16H7a1 1 0 0 1 1 1v3.5M20.5 16H17a1 1 0 0 0-1 1v3.5" />
  </Icon>
);

/** Undo — arrow curling back left. */
export const UndoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h10.5a5 5 0 0 1 0 10H9" />
    <path d="M8 5.5 4 9.5l4 4" />
  </Icon>
);

/** Redo — arrow curling forward right. */
export const RedoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 9.5H9.5a5 5 0 0 0 0 10H15" />
    <path d="M16 5.5l4 4-4 4" />
  </Icon>
);

/* --- map editor drawing tools -------------------------------------------- */

/** Draw walls — a pen nib. */
export const PenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    <path d="M14.5 5.5l3 3" />
  </Icon>
);

/** Draw a room — an empty box. */
export const SquareIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
  </Icon>
);

/** Draw a shop — a storefront with an awning. */
export const StoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5" />
    <path d="M3 9.5 4.7 5a1 1 0 0 1 .93-.64h12.74a1 1 0 0 1 .93.64L21 9.5" />
    <path d="M9.5 20v-5.5h5V20" />
  </Icon>
);

/** Stamp a marker — a pin dropping onto a surface. */
export const StampIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3a4 4 0 0 0-4 4c0 1.5.7 2.3 1.2 3.3.4.8.3 1.7-.2 2.2H15c-.5-.5-.6-1.4-.2-2.2C15.3 9.3 16 8.5 16 7a4 4 0 0 0-4-4Z" />
    <path d="M5 16.5h14M6.5 20.5h11" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Icon>
);

export const PrinterIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 8V3.5h10V8" />
    <path d="M5 8h14a2 2 0 0 1 2 2v6h-4M7 16H3v-6a2 2 0 0 1 2-2Z" />
    <rect x="7" y="13" width="10" height="8" rx="1.5" />
  </Icon>
);

export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20.5 11a8.5 8.5 0 0 0-14.6-4.6L3 9" />
    <path d="M3 4v5h5M3.5 13a8.5 8.5 0 0 0 14.6 4.6L21 15" />
    <path d="M21 20v-5h-5" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </Icon>
);

export const MailIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
    <path d="m3.5 7 7.4 5.2a2 2 0 0 0 2.2 0L20.5 7" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Icon>
);

export const EyeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const EyeOffIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.6 6.1A9.9 9.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.7M6.6 6.8A16.7 16.7 0 0 0 2.5 12S6 18 12 18a9.6 9.6 0 0 0 4-.85" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </Icon>
);

export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M7.5 15.5v-3M12 15.5v-7M16.5 15.5v-5" />
  </Icon>
);

export const FileTextIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.25" />
    <path d="M12 7v5.2l3.2 2" />
  </Icon>
);

export const StarIcon = ({ filled = false, ...p }: IconProps & { filled?: boolean }) => (
  <Icon fill={filled ? "currentColor" : "none"} {...p}>
    <path d="m12 3.5 2.7 5.5 6 .9-4.35 4.24 1.03 6-5.38-2.83L6.6 20.1l1.03-6L3.3 9.9l6-.9L12 3.5Z" />
  </Icon>
);

export const ZapIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
  </Icon>
);

export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20.5a6.5 6.5 0 0 1 13 0" />
    <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M17.5 15.2a6.5 6.5 0 0 1 4 5.3" />
  </Icon>
);

export const GlobeIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9.25" />
    <path d="M2.75 12h18.5M12 2.75c2.3 2.5 3.5 5.7 3.5 9.25S14.3 18.75 12 21.25c-2.3-2.5-3.5-5.7-3.5-9.25S9.7 5.25 12 2.75Z" />
  </Icon>
);

export const CookieIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21.5 12a9.5 9.5 0 1 1-9-9.5 3.5 3.5 0 0 0 4.9 4.2 3.5 3.5 0 0 0 4.1 5.3Z" />
    <path d="M9 9.5h.01M8 15h.01M14 15.5h.01M13 11h.01" />
  </Icon>
);
