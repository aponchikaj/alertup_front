import { fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { en } from '../../../i18n/messages/en';
import { ClosureEdgePicker, type ClosureEdgeOption } from './ClosureEdgePicker';

/* ============================================================================
   ClosureEdgePicker (F16) — the keyboard path for picking which connections a
   closure covers, extracted out of ClosuresPanel.
   ----------------------------------------------------------------------------
   These tests used to mount the whole ClosuresPanel just to reach this list —
   moved here because the seam is now real: the picker owns its own search
   query and needs nothing from ClosuresPanel beyond the options, which ids
   are already picked, and the toggle callback. ClosuresPanel keeps a few
   tests of its own (closuresPanel.test.tsx) that exercise this component
   THROUGH the panel, so the wiring between the two stays covered too.
   ========================================================================= */

/** The floor's connections, as the page hands them over. */
const edgeOption = (
  id: string,
  fromLabel: string,
  toLabel: string,
): ClosureEdgeOption => ({ id, fromLabel, toLabel });

const EDGES: ClosureEdgeOption[] = [
  edgeOption('e1', 'Main hall', 'North stairs'),
  edgeOption('e2', 'North stairs', 'Food court'),
  edgeOption('e3', 'Food court', 'Service door'),
];

const renderPicker = (
  props: Partial<{
    edgeOptions: readonly ClosureEdgeOption[];
    pickedIds: readonly string[];
  }> = {},
) => {
  const onToggleEdge = jest.fn();
  const view = render(
    <LanguageProvider>
      <ClosureEdgePicker
        edgeOptions={props.edgeOptions ?? EDGES}
        pickedIds={props.pickedIds ?? []}
        onToggleEdge={onToggleEdge}
      />
    </LanguageProvider>,
  );
  return { ...view, onToggleEdge };
};

/** The accessible name of one connection's checkbox. */
const edgeName = (from: string, to: string) =>
  en.mapEditor.closureEdgeOption.replace('{from}', from).replace('{to}', to);

describe('ClosureEdgePicker', () => {
  // Basic rendering and the toggle wiring (a checkbox per option, ticking one
  // calls onToggleEdge) stay covered through ClosuresPanel — see "the draft
  // lists the floor connections as checkboxes" and "ticking a connection
  // reports it upstream" in closuresPanel.test.tsx. What follows is behaviour
  // that is entirely local to this component: search filtering, the
  // picked-row exemption, the shown/total arithmetic, and both empty states.

  test('edges picked on the map show as ticked here', () => {
    renderPicker({ pickedIds: ['e3'] });

    expect(
      screen.getByRole('checkbox', { name: edgeName('Food court', 'Service door') }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: edgeName('Main hall', 'North stairs') }),
    ).not.toBeChecked();
  });

  test('unticking a picked connection removes it, so the list can undo a map tap', () => {
    const { onToggleEdge } = renderPicker({ pickedIds: ['e3'] });

    fireEvent.click(
      screen.getByRole('checkbox', { name: edgeName('Food court', 'Service door') }),
    );

    expect(onToggleEdge).toHaveBeenCalledWith('e3');
  });

  test('the search box narrows a dense floor to the connection being looked for', () => {
    renderPicker();

    fireEvent.change(screen.getByLabelText(en.mapEditor.closureEdgeSearch), {
      target: { value: 'service' },
    });

    expect(
      screen.getByRole('checkbox', { name: edgeName('Food court', 'Service door') }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: edgeName('Main hall', 'North stairs') }),
    ).not.toBeInTheDocument();
  });

  test('a filter never hides an already-picked connection — it must stay unpickable', () => {
    // Picked on the map, then filtered out by a search for something else. If
    // the row vanished, the only way to undo the pick would be the pointer.
    renderPicker({ pickedIds: ['e1'] });

    fireEvent.change(screen.getByLabelText(en.mapEditor.closureEdgeSearch), {
      target: { value: 'service' },
    });

    expect(
      screen.getByRole('checkbox', { name: edgeName('Main hall', 'North stairs') }),
    ).toBeChecked();
  });

  test('says so when nothing matches, rather than showing an empty box', () => {
    renderPicker();

    fireEvent.change(screen.getByLabelText(en.mapEditor.closureEdgeSearch), {
      target: { value: 'nowhere' },
    });

    // The visible empty state — the search-results live region (F15 item 3)
    // echoes the same string for screen readers, so it is excluded here.
    expect(
      screen.getByText(en.mapEditor.closureEdgeNone, {
        selector: 'p:not([role="status"])',
      }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  test('a floor with no connections at all gets its own empty state, not "no search match"', () => {
    // F15 item 2: opening a draft on a floor with zero connections showed
    // "No connections match that search" before the operator typed anything —
    // misdiagnosing an empty floor as a failed search.
    renderPicker({ edgeOptions: [] });

    expect(screen.getByText(en.mapEditor.closureEdgeEmpty)).toBeInTheDocument();
    expect(screen.queryByText(en.mapEditor.closureEdgeNone)).not.toBeInTheDocument();
  });

  test('caps the unpicked rows on a dense floor and says how many are left', () => {
    // A tab stop per edge is its own regression: 40 connections would bury the
    // reason field 40 tabs deep. The list shows a window and points at search.
    const many = Array.from({ length: 40 }, (_, i) =>
      edgeOption(`x${i}`, `Room ${i}`, `Corridor ${i}`),
    );
    renderPicker({ edgeOptions: many });

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.length).toBeLessThan(many.length);
    expect(
      screen.getByText(
        en.mapEditor.closureEdgeMore
          .replace('{shown}', String(boxes.length))
          .replace('{total}', String(many.length)),
      ),
    ).toBeInTheDocument();
  });

  test('the shown/total arithmetic reconciles when a row is already picked', () => {
    // F15 item 1: `shown` (rows.length) counted the picked row, but `total`
    // (matched) excluded it — with 40 connections and 1 picked, the panel read
    // "Showing 13 of 39" while 13 + 27 hidden = 40, not 39. Picked rows must
    // be counted in BOTH halves so the arithmetic closes: shown (13) + hidden
    // (27) === total (40).
    const many = Array.from({ length: 40 }, (_, i) =>
      edgeOption(`x${i}`, `Room ${i}`, `Corridor ${i}`),
    );
    renderPicker({ pickedIds: ['x0'], edgeOptions: many });

    // 1 picked row (always shown, uncapped) + 12 windowed matches = 13 shown.
    expect(screen.getAllByRole('checkbox')).toHaveLength(13);
    expect(
      screen.getByText(
        en.mapEditor.closureEdgeMore.replace('{shown}', '13').replace('{total}', '40'),
      ),
    ).toBeInTheDocument();
    // The old, unreconciled reading must be gone.
    expect(
      screen.queryByText(
        en.mapEditor.closureEdgeMore.replace('{shown}', '13').replace('{total}', '39'),
      ),
    ).not.toBeInTheDocument();
  });

  test('search results are announced in a live region, mounted empty before the first search', () => {
    // F15 item 3: the row list, the empty state and "Showing X of Y" all sat
    // outside any live region, so narrowing the search announced nothing to a
    // screen-reader operator. Mounted with the component (not with its text)
    // so the region is being watched before it ever has anything to say.
    //
    // Whether this region stays a SIBLING of ClosuresPanel's own
    // selection-count region (never nested inside it) is a composition
    // contract between the two components, so that assertion stays in
    // closuresPanel.test.tsx, where both regions actually exist together.
    renderPicker();

    const resultsStatus = screen.getByTestId('closure-edge-search-status');
    expect(resultsStatus).toHaveAttribute('role', 'status');
    expect(resultsStatus).toHaveAttribute('aria-live', 'polite');
    expect(resultsStatus).toHaveAttribute('aria-atomic', 'true');
    // Nothing announced before the operator has typed anything.
    expect(resultsStatus).toHaveTextContent('');

    fireEvent.change(screen.getByLabelText(en.mapEditor.closureEdgeSearch), {
      target: { value: 'North stairs' },
    });

    // Now it carries the count of what the search narrowed to.
    expect(resultsStatus).not.toHaveTextContent('');
    expect(resultsStatus.textContent).toMatch(/2|North stairs/i);
  });

  test('the search-results region never hides with display:none when empty', () => {
    renderPicker();
    const resultsStatus = screen.getByTestId('closure-edge-search-status');
    // `sr-only`, never a display:none/empty:hidden utility that would drop it
    // from the accessibility tree.
    expect(resultsStatus.className).not.toMatch(/hidden/);
    expect(resultsStatus).toBeVisible();
  });
});
