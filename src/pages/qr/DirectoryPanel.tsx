import { useMemo, useState } from 'react';
import { Alert, Skeleton } from '../../components/ui/feedback';
import {
  ExitDoorIcon,
  LayersIcon,
  MapPinIcon,
  SearchIcon,
} from '../../components/ui/icons';
import { cn } from '../../lib/cn';
import { useI18n } from '../../i18n/LanguageProvider';
import type { DirectoryEntry } from '../../apis/wayfindingApi';
import type { DestinationSelection } from '../../components/wayfinding/DestinationSearch';

/* ============================================================================
   DirectoryPanel — the building, as a list.
   ----------------------------------------------------------------------------
   The first thing a visitor sees after scanning: every shop, exit, lift and
   named place, searchable as they type. The map appears only after they pick
   something — a list answers "what is here?" faster than a floor plan does,
   and it works one-handed on a phone at arm's length.

   The whole directory arrives in one fetch and filters client-side, so search
   feels instant. Rows group into shops & places / facilities / exits; the
   nearest exit is pinned on top because it is the row that matters when the
   visitor is not browsing.
   ========================================================================= */

export interface DirectoryPanelProps {
  entries: DirectoryEntry[] | null;
  loading: boolean;
  error: string | null;
  onPick: (selection: DestinationSelection) => void;
}

type GroupKey = 'shops' | 'facilities' | 'exits';

const GROUP_TITLES: Record<GroupKey, string> = {
  shops: 'route.directoryShops',
  facilities: 'route.directoryFacilities',
  exits: 'route.directoryExits',
};

const groupOf = (entry: DirectoryEntry): GroupKey => {
  if (entry.nodeType === 'EMERGENCY_EXIT') return 'exits';
  // Named drawn rooms are places someone published on the plan — they belong
  // with the shops, not with lifts and information desks.
  return entry.kind === 'node' ? 'facilities' : 'shops';
};

const GroupIcon = ({ group }: { group: GroupKey }) => {
  const Icon =
    group === 'exits' ? ExitDoorIcon : group === 'facilities' ? LayersIcon : MapPinIcon;
  return <Icon size={16} aria-hidden />;
};

export const DirectoryPanel = ({
  entries,
  loading,
  error,
  onPick,
}: DirectoryPanelProps) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!entries) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(needle) ||
        (entry.category ?? '').toLowerCase().includes(needle) ||
        (entry.floorName ?? '').toLowerCase().includes(needle),
    );
  }, [entries, query]);

  const groups = useMemo(() => {
    const bucket: Record<GroupKey, DirectoryEntry[]> = {
      shops: [],
      facilities: [],
      exits: [],
    };
    for (const entry of filtered) bucket[groupOf(entry)].push(entry);
    return bucket;
  }, [filtered]);

  const floorLabel = (entry: DirectoryEntry): string =>
    entry.floorName ||
    (entry.floorNumber !== null
      ? t('wayfinding.floorShort', { number: entry.floorNumber })
      : '');

  return (
    <div className="flex flex-col gap-4" data-testid="directory-panel">
      {/* Search. A real input with a label for screen readers; the icon is
          decoration, not the label. */}
      <label className="relative block">
        <span className="sr-only">{t('route.directorySearch')}</span>
        <SearchIcon
          size={18}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-subtle"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('route.directorySearch')}
          autoComplete="off"
          className={cn(
            'w-full rounded-xl border border-line bg-surface-2 py-3 pl-11 pr-4 text-base text-ink',
            'placeholder:text-ink-subtle',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          )}
        />
      </label>

      {/* Nearest exit stays pinned above the list — in the moment it matters,
          nobody should have to remember what an exit is called. */}
      <button
        type="button"
        onClick={() => onPick({ kind: 'nearest-exit', name: t('wayfinding.nearestExit') })}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-left',
          'transition-colors hover:bg-surface-hover',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        <span
          aria-hidden
          className="grid h-9 w-9 flex-none place-items-center rounded-full border border-line bg-surface text-success-text"
        >
          <ExitDoorIcon size={18} />
        </span>
        <span className="font-semibold text-ink">{t('wayfinding.nearestExit')}</span>
      </button>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          <span className="sr-only">{t('common.loading')}</span>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      ) : entries && filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-muted">
          {entries.length === 0
            ? t('route.directoryEmptyBuilding')
            : t('route.directoryNoMatch', { query: query.trim() })}
        </p>
      ) : (
        (Object.keys(groups) as GroupKey[]).map((group) => {
          const rows = groups[group];
          if (rows.length === 0) return null;
          return (
            <section key={group} aria-label={t(GROUP_TITLES[group])}>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                <GroupIcon group={group} />
                {t(GROUP_TITLES[group])}
                <span className="font-normal">({rows.length})</span>
              </h3>
              <ul className="flex flex-col overflow-hidden rounded-xl border border-line">
                {rows.map((entry) => (
                  <li key={`${entry.kind}-${entry.poiId ?? entry.nodeId}`}>
                    <button
                      type="button"
                      onClick={() =>
                        onPick({
                          kind: 'poi',
                          poiId: entry.poiId ?? undefined,
                          nodeId: entry.nodeId,
                          name: entry.name,
                        })
                      }
                      className={cn(
                        'flex min-h-12 w-full items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 text-left last:border-b-0',
                        'transition-colors hover:bg-surface-hover',
                        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">
                          {entry.name}
                        </span>
                        {entry.category && (
                          <span className="block truncate text-xs text-ink-subtle">
                            {entry.category}
                          </span>
                        )}
                      </span>
                      {floorLabel(entry) && (
                        <span className="flex-none rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs text-ink-muted">
                          {floorLabel(entry)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
};

export default DirectoryPanel;
