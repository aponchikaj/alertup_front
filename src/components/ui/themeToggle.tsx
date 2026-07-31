import { cn } from "../../lib/cn";
import { useTheme } from "../../theme/useTheme";
import type { ThemePreference } from "../../theme/themeContext";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";

/**
 * Compact toggle for the header. Flips between light and dark in one tap —
 * `system` is reachable from the segmented control in Settings, which is where
 * people go looking for it.
 */
export const ThemeToggle = ({ className }: { className?: string }) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      /* The label states the outcome, not the current state — a screen reader
         user needs to know what pressing it does. */
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      className={cn(
        "relative grid h-10 w-10 place-items-center rounded-full",
        "border border-line bg-surface text-ink-muted",
        "transition-colors duration-200 ease-out",
        "hover:bg-surface-hover hover:text-ink",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      {/* Both glyphs stay mounted and cross-fade, so the button never resizes. */}
      <SunIcon
        size={19}
        className={cn(
          "absolute transition-all duration-300 ease-out",
          resolvedTheme === "dark"
            ? "scale-50 rotate-90 opacity-0"
            : "scale-100 rotate-0 opacity-100",
        )}
      />
      <MoonIcon
        size={19}
        className={cn(
          "absolute transition-all duration-300 ease-out",
          resolvedTheme === "dark"
            ? "scale-100 rotate-0 opacity-100"
            : "scale-50 -rotate-90 opacity-0",
        )}
      />
    </button>
  );
};

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
];

/** Three-way picker for Settings. Exposes `system`, which the header toggle can't. */
export const ThemePicker = ({ className }: { className?: string }) => {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "inline-flex gap-1 rounded-full border border-line bg-surface-2 p-1",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium",
              "transition-colors duration-200 ease-out",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              selected
                ? "bg-brand text-brand-ink shadow-sm"
                : "text-ink-muted hover:bg-surface-hover hover:text-ink",
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
