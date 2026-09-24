import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { en } from '../../../i18n/messages/en';
import { EdgeInspector } from './edgeInspector';
import type { EditorEdge, EditorNode } from '../../../apis/mapEditorApi';

/* ============================================================================
   EdgeInspector — direction, tags and the closure-draft button.
   ----------------------------------------------------------------------------
   Direction is relative to the edge's stored source → target, so the two
   one-way options must be spelled with the endpoint labels rather than with
   "FORWARD"/"REVERSE" — an operator cannot tell which way "forward" points.
   ========================================================================= */

const node = (id: string, label: string): EditorNode => ({
  id,
  floorId: 'f1',
  buildingId: 'b1',
  x: 10,
  y: 20,
  type: 'NORMAL',
  label,
  qrSlug: null,
  scanCount: 0,
});

const edge = (over: Partial<EditorEdge> = {}): EditorEdge => ({
  id: 'e1',
  buildingId: 'b1',
  sourceNodeId: 'n1',
  targetNodeId: 'n2',
  transitType: 'WALKWAY',
  accessible: true,
  distance: 120,
  direction: 'BOTH',
  tags: [],
  ...over,
});

const lobby = node('n1', 'Lobby');
const corridor = node('n2', 'Corridor');

const renderInspector = (props: Partial<Parameters<typeof EdgeInspector>[0]> = {}) => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const onDelete = jest.fn().mockResolvedValue(undefined);
  const view = render(
    <LanguageProvider>
      <EdgeInspector
        edge={edge()}
        source={lobby}
        target={corridor}
        onSave={onSave}
        onDelete={onDelete}
        {...props}
      />
    </LanguageProvider>,
  );
  return { ...view, onSave, onDelete };
};

describe('EdgeInspector — direction', () => {
  test('spells the one-way options with the endpoint labels', () => {
    renderInspector();

    const select = screen.getByLabelText(en.mapEditor.edgeDirection) as HTMLSelectElement;
    expect(select).toHaveValue('BOTH');

    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toEqual([
      en.mapEditor.edgeDirectionBoth,
      'Lobby → Corridor',
      'Corridor → Lobby',
    ]);
  });

  test('saves the chosen direction alongside the existing fields', async () => {
    const { onSave } = renderInspector();

    fireEvent.change(screen.getByLabelText(en.mapEditor.edgeDirection), {
      target: { value: 'FORWARD' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.common.save }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'FORWARD', tags: [] }),
    );
  });
});

describe('EdgeInspector — tags', () => {
  test('Enter turns the draft into a chip and Save sends every chip', async () => {
    const { onSave } = renderInspector();

    const input = screen.getByLabelText(en.mapEditor.edgeTags);
    fireEvent.change(input, { target: { value: 'outdoor' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'narrow' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('outdoor')).toBeInTheDocument();
    expect(screen.getByText('narrow')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: en.common.save }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['outdoor', 'narrow'] }),
    );
  });

  test('a chip can be removed again', () => {
    renderInspector({ edge: edge({ tags: ['outdoor'] }) });

    expect(screen.getByText('outdoor')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: `${en.common.delete} outdoor` }),
    );
    expect(screen.queryByText('outdoor')).not.toBeInTheDocument();
  });
});

describe('EdgeInspector — re-seeding', () => {
  test('pointing at another edge replaces direction and tags', () => {
    const { rerender } = renderInspector({
      edge: edge({ direction: 'FORWARD', tags: ['outdoor'] }),
    });

    expect(screen.getByLabelText(en.mapEditor.edgeDirection)).toHaveValue('FORWARD');
    expect(screen.getByText('outdoor')).toBeInTheDocument();

    rerender(
      <LanguageProvider>
        <EdgeInspector
          edge={edge({ id: 'e2', direction: 'REVERSE', tags: ['stairs-only'] })}
          source={lobby}
          target={corridor}
          onSave={jest.fn()}
          onDelete={jest.fn()}
        />
      </LanguageProvider>,
    );

    expect(screen.getByLabelText(en.mapEditor.edgeDirection)).toHaveValue('REVERSE');
    expect(screen.queryByText('outdoor')).not.toBeInTheDocument();
    expect(screen.getByText('stairs-only')).toBeInTheDocument();
  });
});

describe('EdgeInspector — adding to a closure draft', () => {
  test('no "Add to closure" button unless a draft is being picked', () => {
    renderInspector();
    expect(
      screen.queryByRole('button', { name: en.mapEditor.closureAddEdge }),
    ).not.toBeInTheDocument();
  });

  // Pointer-driven: the button only exists for an already-selected edge, and
  // selecting one means clicking a bare SVG line. See the prop's doc comment.
  test('while a draft is open the button adds the selected edge', () => {
    const onAddToClosure = jest.fn();
    renderInspector({ closureDraftActive: true, onAddToClosure });

    fireEvent.click(
      screen.getByRole('button', { name: en.mapEditor.closureAddEdge }),
    );
    expect(onAddToClosure).toHaveBeenCalledTimes(1);
  });
});
