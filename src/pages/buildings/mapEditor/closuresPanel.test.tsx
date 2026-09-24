import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { en } from '../../../i18n/messages/en';
import { ClosuresPanel, type ClosuresPanelProps } from './closuresPanel';
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

const renderPanel = (props: Partial<ClosuresPanelProps> = {}) => {
  const onCreate = jest
    .fn<Promise<boolean>, [Parameters<ClosuresPanelProps['onCreate']>[0]]>()
    .mockResolvedValue(true);
  const onDelete = jest.fn<Promise<void>, [string]>().mockResolvedValue();
  const onStartDraft = jest.fn();
  const onCancelDraft = jest.fn();

  const view = render(
    <LanguageProvider>
      <ClosuresPanel
        closures={[]}
        draftEdgeIds={null}
        onStartDraft={onStartDraft}
        onCancelDraft={onCancelDraft}
        onCreate={onCreate}
        onDelete={onDelete}
        {...props}
      />
    </LanguageProvider>,
  );
  return { ...view, onCreate, onDelete, onStartDraft, onCancelDraft };
};

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
