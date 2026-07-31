import { useEffect, useId, useRef, useState } from "react";
import { searchPois, type PoiSearchResult } from "../../apis/wayfindingApi";
import { useI18n } from "../../i18n/LanguageProvider";
import { cn } from "../../lib/cn";
import { SearchIcon, ExitDoorIcon, SpinnerIcon } from "../ui/icons";

/* ============================================================================
   DestinationSearch — "where do you want to go?"
   ----------------------------------------------------------------------------
   A combobox over the building's POIs, with "nearest exit" pinned first so the
   safety action is always one tap away, even in normal browsing.
   ========================================================================= */

export interface DestinationSelection {
  kind: "poi" | "nearest-exit";
  poiId?: string;
  nodeId?: string;
  name: string;
}

export interface DestinationSearchProps {
  buildingId: string;
  onSelect: (selection: DestinationSelection) => void;
  autoFocus?: boolean;
  className?: string;
}

const DEBOUNCE_MS = 250;

export const DestinationSearch = ({
  buildingId,
  onSelect,
  autoFocus = false,
  className,
}: DestinationSearchProps) => {
  const { t } = useI18n();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PoiSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchPois(buildingId, query, {
          signal: controller.signal,
        });
        setResults(found);
      } catch {
        // Aborted or offline: keep whatever is on screen rather than blanking
        // the list under the user's finger.
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [buildingId, query]);

  const options: DestinationSelection[] = [
    { kind: "nearest-exit", name: t("wayfinding.nearestExit") },
    ...results.map<DestinationSelection>((poi) => ({
      kind: "poi",
      poiId: poi.poiId,
      nodeId: poi.nodeId,
      name: poi.name,
    })),
  ];

  const choose = (option: DestinationSelection) => {
    onSelect(option);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      choose(options[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-subtle"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={t("wayfinding.whereTo")}
          placeholder={t("wayfinding.searchPlaceholder")}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="min-h-11 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-10 text-base text-ink outline-none placeholder:text-ink-subtle focus-visible:border-line-strong"
        />
        {loading ? (
          <SpinnerIcon
            className="absolute right-3 top-1/2 size-5 -translate-y-1/2 text-ink-subtle"
            aria-hidden="true"
          />
        ) : null}
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("wayfinding.whereTo")}
          className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg"
        >
          {options.map((option, index) => (
            <li key={option.poiId ?? option.kind} role="none">
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition",
                  index === activeIndex
                    ? "bg-surface-hover text-ink"
                    : "text-ink-muted hover:text-ink",
                  option.kind === "nearest-exit" && "font-semibold text-ink",
                )}
              >
                {option.kind === "nearest-exit" ? (
                  <ExitDoorIcon className="size-4 shrink-0 text-success" aria-hidden="true" />
                ) : null}
                <span className="truncate">{option.name}</span>
                {option.kind === "poi" ? (
                  <span className="ml-auto shrink-0 text-xs text-ink-subtle">
                    {resultFloorLabel(results, option.poiId, t)}
                  </span>
                ) : null}
              </button>
            </li>
          ))}

          {!loading && results.length === 0 && query.trim() ? (
            <li className="px-3 py-3 text-sm text-ink-subtle">
              {t("wayfinding.noResults")}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
};

function resultFloorLabel(
  results: PoiSearchResult[],
  poiId: string | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const match = results.find((r) => r.poiId === poiId);
  if (!match || match.floorNumber === null) return "";
  return t("wayfinding.floorShort", { number: match.floorNumber });
}

export default DestinationSearch;
