import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { en } from '../../../i18n/messages/en';
import {
  ClosuresPanel,
  type ClosureEdgeOption,
  type ClosuresPanelProps,
} from './closuresPanel';
import type { Closure } from '../../../apis/mapEditorApi';

/* ============================================================================
   ClosuresPanel — "this corridor is shut" without a command line.
   ----------------------------------------------------------------------------
   Two things here are safety-critical and so are pinned hard:
   * `costMultiplier: null` is the BLOCKED sentinel on the wire. It must never
     be what the form sends because nobody touched the control — hence the
     disabled-until-chosen test.
   * There is no updateClosure on the client, so the list offers delete only.
   ========================================================================= */

const NOW = Date.parse('2026-09-25T10:00:00.000Z');

const closure = (over: Partial<Closure> = {}): Closure => ({
  id: 'c1',
  floorId: 'f1',
  edgeIds: ['e1', 'e2'],
  nodeIds: [],
  costMultiplier: null,
  reason: 'Burst pipe',
  startsAt: '2026-09-25T09:00:00.000Z',
  endsAt: '2026-09-25T13:00:00.000Z',
  createdById: null,
  createdAt: null,
  updatedAt: null,
  blocked: true,
  active: true,
  ...over,
});

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

const renderPanel = (props: Partial<ClosuresPanelProps> = {}) => {
  const onCreate = jest
    .fn<Promise<boolean>, [Parameters<ClosuresPanelProps['onCreate']>[0]]>()
    .mockResolvedValue(true);
  const onDelete = jest.fn<Promise<void>, [string]>().mockResolvedValue();
  const onStartDraft = jest.fn();
  const onCancelDraft = jest.fn();
  const onToggleEdge = jest.fn();

  const view = render(
    <LanguageProvider>
      <ClosuresPanel
        closures={[]}
        draftEdgeIds={null}
        edgeOptions={EDGES}
        onStartDraft={onStartDraft}
        onCancelDraft={onCancelDraft}
        onToggleEdge={onToggleEdge}
        onCreate={onCreate}
        onDelete={onDelete}
        {...props}
      />
    </LanguageProvider>,
  );
  return { ...view, onCreate, onDelete, onStartDraft, onCancelDraft, onToggleEdge };
};

/** The accessible name of one connection's checkbox. */
const edgeName = (from: string, to: string) =>
  en.mapEditor.closureEdgeOption.replace('{from}', from).replace('{to}', to);

/** Fill everything the save button waits on, minus whatever the test omits. */
const fillDraft = (opts: { reason?: string; effect?: string } = {}) => {
  fireEvent.change(screen.getByLabelText(en.mapEditor.closureReason), {
    target: { value: opts.reason ?? 'Burst pipe' },
  });
  fireEvent.click(
    screen.getByRole('radio', { name: opts.effect ?? en.mapEditor.closureBlocked }),
  );
};

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ClosuresPanel — the list', () => {
  test('says so when there is nothing closed', () => {
    renderPanel();
    expect(screen.getByText(en.mapEditor.closuresEmpty)).toBeInTheDocument();
  });

  test('shows the reason, the end time and how many connections it covers', () => {
    renderPanel({ closures: [closure()] });

    expect(screen.getByText('Burst pipe')).toBeInTheDocument();
    expect(
      screen.getByText(en.mapEditor.closureSelectedCount.replace('{count}', '2')),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Ends /)).toBeInTheDocument();
  });

  test('offers no edit affordance — the client has no updateClosure', () => {
    renderPanel({ closures: [closure()] });
    expect(screen.queryByRole('button', { name: en.common.save })).not.toBeInTheDocument();
  });

  test('delete asks for confirmation before it calls through', async () => {
    const { onDelete } = renderPanel({ closures: [closure()] });

    fireEvent.click(screen.getByRole('button', { name: en.mapEditor.closureDelete }));
    expect(onDelete).not.toHaveBeenCalled();

    expect(
      await screen.findByText(en.mapEditor.closureDeleteConfirm),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.common.delete }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('c1'));
  });
});

describe('ClosuresPanel — the draft', () => {
  test('the add button arms edge picking rather than saving anything', () => {
    const { onStartDraft } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: en.mapEditor.closureAdd }));
    expect(onStartDraft).toHaveBeenCalledTimes(1);
  });

  test('announces the running selection count in a live region', () => {
    const { rerender } = renderPanel({ draftEdgeIds: [] });

    const live = screen.getByText(
      en.mapEditor.closureSelectedCount.replace('{count}', '0'),
    );
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText(en.mapEditor.closurePickEdges)).toBeInTheDocument();

    rerender(
      <LanguageProvider>
        <ClosuresPanel
          closures={[]}
          edgeOptions={EDGES}
          onToggleEdge={jest.fn()}
          draftEdgeIds={['e1', 'e2', 'e3']}
          onStartDraft={jest.fn()}
          onCancelDraft={jest.fn()}
          onCreate={jest.fn().mockResolvedValue(true)}
          onDelete={jest.fn().mockResolvedValue(undefined)}
        />
      </LanguageProvider>,
    );

    expect(
      screen.getByText(en.mapEditor.closureSelectedCount.replace('{count}', '3')),
    ).toBeInTheDocument();
  });

  test('save stays disabled until a reason, an edge and an effect are all set', () => {
    const { rerender } = renderPanel({ draftEdgeIds: [] });
    const saveButton = () => screen.getByRole('button', { name: en.common.save });

    expect(saveButton()).toBeDisabled();

    fillDraft();
    // Reason and effect are set, but no edge has been picked yet.
    expect(saveButton()).toBeDisabled();

    rerender(
      <LanguageProvider>
        <ClosuresPanel
          closures={[]}
          edgeOptions={EDGES}
          onToggleEdge={jest.fn()}
          draftEdgeIds={['e1']}
          onStartDraft={jest.fn()}
          onCancelDraft={jest.fn()}
          onCreate={jest.fn().mockResolvedValue(true)}
          onDelete={jest.fn().mockResolvedValue(undefined)}
        />
      </LanguageProvider>,
    );

    expect(saveButton()).toBeEnabled();
  });

  test('blocking is a deliberate click, never the form default', () => {
    renderPanel({ draftEdgeIds: ['e1'] });

    expect(
      screen.getByRole('radio', { name: en.mapEditor.closureBlocked }),
    ).not.toBeChecked();
    expect(
      screen.getByRole('radio', { name: en.mapEditor.closureSlowed }),
    ).not.toBeChecked();
  });

  test('the 1 h preset ends the closure an hour from now, blocked outright', async () => {
    const { onCreate } = renderPanel({ draftEdgeIds: ['e1'] });

    fillDraft();
    fireEvent.click(
      screen.getByRole('radio', {
        name: en.mapEditor.closureHours.replace('{hours}', '1'),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: en.common.save }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith({
      reason: 'Burst pipe',
      endsAt: new Date(NOW + 60 * 60 * 1000).toISOString(),
      costMultiplier: null,
    });
  });

  test('"slow down" sends a multiplier instead of the blocking null', async () => {
    const { onCreate } = renderPanel({ draftEdgeIds: ['e1'] });

    fillDraft({ effect: en.mapEditor.closureSlowed });
    fireEvent.change(screen.getByLabelText(en.mapEditor.closureSlowFactor), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.common.save }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0][0].costMultiplier).toBe(4);
  });

  test('the custom preset takes a datetime-local value', async () => {
    const { onCreate } = renderPanel({ draftEdgeIds: ['e1'] });

    fillDraft();
    fireEvent.click(screen.getByRole('radio', { name: en.mapEditor.closureCustom }));

    // "Custom" names two controls: the preset radio and the field it reveals.
    // Scope to the field.
    const when = screen.getByLabelText(en.mapEditor.closureCustom, {
      selector: 'input[type="datetime-local"]',
    });
    expect(when).toHaveAttribute('type', 'datetime-local');
    // No value yet: an empty custom end is not a saveable closure.
    expect(screen.getByRole('button', { name: en.common.save })).toBeDisabled();

    fireEvent.change(when, { target: { value: '2026-09-26T08:30' } });
    fireEvent.click(screen.getByRole('button', { name: en.common.save }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0][0].endsAt).toBe(
      new Date('2026-09-26T08:30').toISOString(),
    );
  });

  test('a failed create keeps the form exactly as it was', async () => {
    const { onCreate } = renderPanel({ draftEdgeIds: ['e1'] });
    onCreate.mockRejectedValueOnce(new Error('boom'));

    fillDraft({ reason: 'Burst pipe' });
    fireEvent.click(screen.getByRole('button', { name: en.common.save }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    // The edges are still picked upstream, so wiping the reason and the effect
    // would leave a half-filled draft nobody can tell is half-filled.
    await waitFor(() =>
      expect(screen.getByLabelText(en.mapEditor.closureReason)).toHaveValue(
        'Burst pipe',
      ),
    );
    expect(
      screen.getByRole('radio', { name: en.mapEditor.closureBlocked }),
    ).toBeChecked();
  });

  test('the preset end is measured from the click, not from the last keystroke', async () => {
    const { onCreate } = renderPanel({ draftEdgeIds: ['e1'] });

    fillDraft();
    // Five minutes pass between filling the form and pressing Save.
    const clickedAt = NOW + 5 * 60 * 1000;
    jest.spyOn(Date, 'now').mockReturnValue(clickedAt);
    fireEvent.click(screen.getByRole('button', { name: en.common.save }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0][0].endsAt).toBe(
      new Date(clickedAt + 60 * 60 * 1000).toISOString(),
    );
  });

  test('a custom end in the past is refused, and the field says so', () => {
    renderPanel({ draftEdgeIds: ['e1'] });

    fillDraft();
    fireEvent.click(screen.getByRole('radio', { name: en.mapEditor.closureCustom }));

    const when = screen.getByLabelText(en.mapEditor.closureCustom, {
      selector: 'input[type="datetime-local"]',
    });
    // The picker itself refuses earlier instants.
    expect(when).toHaveAttribute('min');

    fireEvent.change(when, { target: { value: '2020-01-01T08:30' } });
    expect(screen.getByRole('button', { name: en.common.save })).toBeDisabled();
  });

  test('cancel drops the draft', () => {
    const { onCancelDraft } = renderPanel({ draftEdgeIds: ['e1'] });
    fireEvent.click(screen.getByRole('button', { name: en.common.cancel }));
    expect(onCancelDraft).toHaveBeenCalledTimes(1);
  });
});

/* ============================================================================
   The keyboard path (F13).
   ----------------------------------------------------------------------------
   F12 shipped edge picking as a map gesture only: EdgeLayer's edges are bare
   SVG <line> elements with no tabIndex and no role, so an operator without a
   pointer could fill in every field of a closure and never enable Save. The
   draft therefore also lists the floor's connections as checkboxes — one tab
   stop per visible row, a search box to narrow a dense floor, and the same
   `draftEdgeIds` the map paints, so the two pickers can never disagree.
   ========================================================================= */
describe('ClosuresPanel — picking connections without a pointer', () => {
  test('the draft lists the floor connections as checkboxes', () => {
    renderPanel({ draftEdgeIds: [] });

    const list = screen.getByRole('group', { name: en.mapEditor.closureEdgeList });
    expect(list).toBeInTheDocument();
    for (const edge of EDGES) {
      expect(
        screen.getByRole('checkbox', { name: edgeName(edge.fromLabel, edge.toLabel) }),
      ).toBeInTheDocument();
    }
  });

  test('no list until a draft is open — there is nothing to pick into', () => {
    renderPanel();
    expect(
      screen.queryByRole('group', { name: en.mapEditor.closureEdgeList }),
    ).not.toBeInTheDocument();
  });

  test('ticking a connection reports it upstream, the same call a map tap makes', () => {
    const { onToggleEdge } = renderPanel({ draftEdgeIds: [] });

    fireEvent.click(
      screen.getByRole('checkbox', { name: edgeName('North stairs', 'Food court') }),
    );

    expect(onToggleEdge).toHaveBeenCalledWith('e2');
  });

  test('edges picked on the map show as ticked here', () => {
    renderPanel({ draftEdgeIds: ['e3'] });

    expect(
      screen.getByRole('checkbox', { name: edgeName('Food court', 'Service door') }),
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: edgeName('Main hall', 'North stairs') }),
    ).not.toBeChecked();
  });

  test('unticking a picked connection removes it, so the list can undo a map tap', () => {
    const { onToggleEdge } = renderPanel({ draftEdgeIds: ['e3'] });

    fireEvent.click(
      screen.getByRole('checkbox', { name: edgeName('Food court', 'Service door') }),
    );

    expect(onToggleEdge).toHaveBeenCalledWith('e3');
  });

  test('the search box narrows a dense floor to the connection being looked for', () => {
    renderPanel({ draftEdgeIds: [] });

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
    renderPanel({ draftEdgeIds: ['e1'] });

    fireEvent.change(screen.getByLabelText(en.mapEditor.closureEdgeSearch), {
      target: { value: 'service' },
    });

    expect(
      screen.getByRole('checkbox', { name: edgeName('Main hall', 'North stairs') }),
    ).toBeChecked();
  });

  test('says so when nothing matches, rather than showing an empty box', () => {
    renderPanel({ draftEdgeIds: [] });

    fireEvent.change(screen.getByLabelText(en.mapEditor.closureEdgeSearch), {
      target: { value: 'nowhere' },
    });

    expect(screen.getByText(en.mapEditor.closureEdgeNone)).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  test('caps the unpicked rows on a dense floor and says how many are left', () => {
    // A tab stop per edge is its own regression: 40 connections would bury the
    // reason field 40 tabs deep. The list shows a window and points at search.
    const many = Array.from({ length: 40 }, (_, i) =>
      edgeOption(`x${i}`, `Room ${i}`, `Corridor ${i}`),
    );
    renderPanel({ draftEdgeIds: [], edgeOptions: many });

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

  test('the count is a status region, announced whole', () => {
    renderPanel({ draftEdgeIds: ['e1'] });

    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveAttribute('aria-atomic', 'true');
    // One connection is not "1 connections".
    expect(live).toHaveTextContent(en.mapEditor.closureSelectedCountOne);
  });

  test('the slow-down factors say what the number means, not just "2×"', () => {
    renderPanel({ draftEdgeIds: ['e1'] });
    fillDraft({ effect: en.mapEditor.closureSlowed });

    expect(
      screen.getByRole('option', {
        name: en.mapEditor.closureSlowFactorOption.replace('{factor}', '2'),
      }),
    ).toBeInTheDocument();
  });
});
