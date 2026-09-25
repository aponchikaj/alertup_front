import { useMemo, useState } from 'react';
import { TextField } from '../../../components/ui/field';
import { useI18n } from '../../../i18n/LanguageProvider';

/* ============================================================================
   ClosureEdgePicker — the keyboard path for picking which connections a
   closure covers.
   ----------------------------------------------------------------------------
   EdgeLayer draws edges as bare SVG <line> elements with neither tabIndex nor
   a role, so without this list a keyboard-only operator could fill in every
   other field of a closure and never be able to pick an edge at all. This
   component is the search box, the live announcements and the checkbox list
   that make picking possible without a pointer. It writes to the same
   `pickedIds` (via `onToggleEdge`) that a map tap does, so the two pickers can
   never disagree: a tap on the map ticks a row here, and a row ticked here
   lights up on the map.

   Self-contained on purpose: the only things it needs from the outside are
   the full set of connections for the active floor, which of them are
   already picked, and the toggle callback — the search query is its own,
   local, throwaway state.
   ========================================================================= */

/**
 * How many UNPICKED connections the list offers at once.
 *
 * One tab stop per edge would be its own accessibility regression — a floor
 * with forty connections would bury the reason field forty tabs deep — so the
 * list is a window onto the search results, and the count of what is hidden is
 * stated rather than silent. Picked rows are exempt from the cap: whatever is
 * in the draft must always be un-pickable without a mouse, including the rows
 * a later search would otherwise filter away.
 */
const EDGE_WINDOW = 12;

/** One connection of the active floor, already named for a human. */
export interface ClosureEdgeOption {
  id: string;
  /** The `sourceNodeId` end, labelled exactly as the direction Select does. */
  fromLabel: string;
  /** The `targetNodeId` end. */
  toLabel: string;
}

export interface ClosureEdgePickerProps {
  /** Every connection on the active floor, for the keyboard picker. */
  edgeOptions: readonly ClosureEdgeOption[];
  /** The edges picked so far — from the map, from this list, or both. */
  pickedIds: readonly string[];
  /** Same handler a map tap fires — picks or unpicks one connection. */
  onToggleEdge: (edgeId: string) => void;
}

export const ClosureEdgePicker = ({
  edgeOptions,
  pickedIds,
  onToggleEdge,
}: ClosureEdgePickerProps) => {
  const { t } = useI18n();
  const [edgeQuery, setEdgeQuery] = useState('');

  const pickedIdSet = useMemo(() => new Set(pickedIds), [pickedIds]);

  // Distinct from a failed search: a floor with zero connections has nothing
  // to search yet, so blaming the search box for the empty list would be
  // wrong the moment a draft opens, before the operator has typed anything.
  const edgeEmptyMessage =
    edgeOptions.length === 0
      ? t('mapEditor.closureEdgeEmpty')
      : t('mapEditor.closureEdgeNone');

  const optionLabel = (option: ClosureEdgeOption) =>
    t('mapEditor.closureEdgeOption', {
      from: option.fromLabel,
      to: option.toLabel,
    });

  /**
   * Picked rows first and always, then the search hits, then the cap.
   *
   * The ordering is the accessibility requirement, not a nicety: an edge
   * picked on the map and then filtered out by a search for something else
   * would otherwise only be removable with the pointer that put it there.
   *
   * That guarantee holds only WITHIN the active floor: `edgeOptions` is
   * scoped to it, so a row picked before a floor switch can drop out of this
   * list entirely — the count still says "N connections selected" with fewer
   * rows ticked here. This is parity with the map, not a bug: EdgeLayer does
   * not draw the other floor's edge either, so neither picker can reach it
   * until the operator switches back.
   */
  const edgeRows = useMemo(() => {
    const query = edgeQuery.trim().toLowerCase();
    const picked: ClosureEdgeOption[] = [];
    const matches: ClosureEdgeOption[] = [];

    for (const option of edgeOptions) {
      if (pickedIdSet.has(option.id)) {
        picked.push(option);
        continue;
      }
      if (
        query === '' ||
        `${option.fromLabel} ${option.toLabel}`.toLowerCase().includes(query)
      ) {
        matches.push(option);
      }
    }

    return {
      rows: [...picked, ...matches.slice(0, EDGE_WINDOW)],
      // `total` covers the same set `rows.length` (shown) and `hidden` add up
      // to: every picked row PLUS every match, windowed or not. Counting
      // picked rows into `rows.length` but not into `total` was the F15 bug —
      // "Showing 15 of 37" while 25 more sat hidden, 15 + 25 = 40 != 37.
      total: picked.length + matches.length,
      hidden: Math.max(matches.length - EDGE_WINDOW, 0),
      // Raw match count, BEFORE the window cap — what the search-results live
      // region announces. Picked rows are excluded here on purpose: they are
      // not something the search narrowed to, they were already on the draft.
      matchCount: matches.length,
    };
  }, [edgeOptions, edgeQuery, pickedIdSet]);

  return (
    <div className="flex flex-col gap-2">
      <TextField
        label={t('mapEditor.closureEdgeSearch')}
        hint={t('mapEditor.closureEdgeSearchHint')}
        type="search"
        value={edgeQuery}
        onChange={(e) => setEdgeQuery(e.target.value)}
      />

      {/* The search-results announcement (F15 item 3). The row list, the
          empty state and "Showing X of Y" below are all silent to a
          screen reader — this is the one thing that speaks as the query
          narrows. Mounted WITH the draft, not with its text: an empty
          string here until the first search, never unmounted, so the
          region is already being watched by the time it has something
          to say. `sr-only`, never `hidden`/`display:none` — either of
          those would drop it from the accessibility tree, undoing the
          fix. A sibling of the selection-count status the panel renders
          above this component, not nested inside it, so the two never
          announce as one region. */}
      <p
        data-testid="closure-edge-search-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {edgeQuery.trim() === ''
          ? ''
          : edgeRows.matchCount === 0
            ? edgeEmptyMessage
            : edgeRows.matchCount === 1
              ? t('mapEditor.closureEdgeSearchCountOne')
              : t('mapEditor.closureEdgeSearchCount', {
                  count: edgeRows.matchCount,
                })}
      </p>

      {edgeRows.rows.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {/* A floor with zero connections is not a failed search — the
              operator has not necessarily typed anything yet. */}
          {edgeEmptyMessage}
        </p>
      ) : (
        <div
          role="group"
          aria-label={t('mapEditor.closureEdgeList')}
          className="max-h-64 overflow-y-auto rounded-xl border border-line bg-surface-2 p-2"
        >
          <ul className="flex flex-col">
            {edgeRows.rows.map((option) => (
              <li key={option.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-surface-hover">
                  <input
                    type="checkbox"
                    checked={pickedIdSet.has(option.id)}
                    onChange={() => onToggleEdge(option.id)}
                    className="h-4 w-4 shrink-0 rounded border-line accent-[var(--brand)]"
                  />
                  <span className="min-w-0 break-words">{optionLabel(option)}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {edgeRows.hidden > 0 && (
        <p className="text-xs text-ink-subtle">
          {t('mapEditor.closureEdgeMore', {
            shown: edgeRows.rows.length,
            total: edgeRows.total,
          })}
        </p>
      )}
    </div>
  );
};

export default ClosureEdgePicker;
