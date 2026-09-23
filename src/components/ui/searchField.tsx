import { useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { searchFieldStyles } from "./styles";
import { SearchIcon, CloseIcon } from "./icons";

/* ============================================================================
   SearchField — the single most important control in the product.
   ----------------------------------------------------------------------------
   This is what a visitor touches first, usually on a phone, often in a hurry.
   It is deliberately larger than anything else on the screen: 56px tall, 18px
   text, pill, one obvious affordance.

   Suggestions are keyboard-navigable (ArrowUp/ArrowDown/Enter/Escape) and wired
   as a combobox, because "type and hope" is not a design.
   ========================================================================= */

export interface SearchSuggestion {
  id: string;
  label: string;
  /** e.g. "Floor 2 · Shops" — the disambiguator, not decoration. */
  detail?: string;
  icon?: ReactNode;
}

export interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onSelect" | "className"> {
  label: string;
  suggestions?: SearchSuggestion[];
  onSelectSuggestion?: (s: SearchSuggestion) => void;
  onClear?: () => void;
  className?: string;
}

export const SearchField = ({
  label,
  suggestions = [],
  onSelectSuggestion,
  onClear,
  className,
  value,
  ...props
}: SearchFieldProps) => {
  const id = useId();
  const listId = `${id}-list`;
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = open && suggestions.length > 0;
  const hasValue = Boolean(value);

  const choose = (s: SearchSuggestion) => {
    onSelectSuggestion?.(s);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      <SearchIcon
        size={22}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3"
      />

      <input
        {...props}
        id={id}
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        value={value}
        className={searchFieldStyles({ className: hasValue ? "pr-12" : undefined })}
        onFocus={() => setOpen(true)}
        // A click outside should close it, but blur fires before the option's
        // click — so the close is deferred by a tick.
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!suggestions.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (i + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            choose(suggestions[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
        }}
      />

      {hasValue && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onClear?.();
            inputRef.current?.focus();
          }}
          className={cn(
            "absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center",
            "rounded-pill text-ink-3 hover:bg-surface-2 hover:text-ink",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          )}
        >
          <CloseIcon size={18} />
        </button>
      )}

      {visible && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className={cn(
            "absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden",
            "rounded-lg border border-line bg-surface shadow-md",
          )}
        >
          {suggestions.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(s)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left",
                  "border-b border-line last:border-b-0",
                  i === active ? "bg-surface-2" : "bg-surface",
                )}
              >
                {s.icon ? <span className="text-ink-3">{s.icon}</span> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink">{s.label}</span>
                  {s.detail ? (
                    <span className="block truncate text-sm text-ink-3">{s.detail}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchField;
