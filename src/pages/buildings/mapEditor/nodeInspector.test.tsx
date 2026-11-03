import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../../../i18n/LanguageProvider';
import { en } from '../../../i18n/messages/en';
import { NodeInspector, type PoiFormValues } from './nodeInspector';
import type { EditorNode, EditorPoi } from '../../../apis/mapEditorApi';

/* ============================================================================
   NodeInspector — printed code and search aliases.
   ----------------------------------------------------------------------------
   The alias chips are the dangerous field: the backend replaces the whole
   `names` JSON column whenever the key is present at all, so "the user did not
   touch the chips" has to reach savePoi as an ABSENT key, not as an empty
   array. That is what the untouched-chips test pins down.
   ========================================================================= */

const node: EditorNode = {
  id: 'n1',
  floorId: 'f1',
  buildingId: 'b1',
  x: 10,
  y: 20,
  type: 'POI',
  label: 'Unit 12',
  qrSlug: null,
  scanCount: 0,
};

const poi: EditorPoi = {
  id: 'p1',
  nodeId: 'n1',
  name: 'Aversi',
  category: 'pharmacy',
  description: null,
  keywords: [],
  externalId: undefined,
  aliases: [],
};

const renderInspector = (over: Partial<EditorPoi> | null = {}) => {
  const onSavePoi = jest.fn<Promise<void>, [PoiFormValues]>().mockResolvedValue();
  render(
    <LanguageProvider>
      <NodeInspector
        node={node}
        poi={over === null ? null : { ...poi, ...over }}
        onSaveNode={jest.fn().mockResolvedValue(undefined)}
        onDeleteNode={jest.fn().mockResolvedValue(undefined)}
        onSavePoi={onSavePoi}
        onRemovePoi={jest.fn().mockResolvedValue(undefined)}
        onShowQr={jest.fn()}
      />
    </LanguageProvider>,
  );
  return { onSavePoi };
};

const save = () =>
  fireEvent.click(screen.getByRole('button', { name: en.mapEditor.savePoi }));

describe('NodeInspector — printed code', () => {
  test('seeds from the POI and submits what was typed', async () => {
    const { onSavePoi } = renderInspector({ externalId: 'R-101' });

    const field = screen.getByLabelText(en.mapEditor.poiExternalId);
    expect(field).toHaveValue('R-101');
    expect(screen.getByText(en.mapEditor.poiExternalIdHint)).toBeInTheDocument();

    fireEvent.change(field, { target: { value: 'R-202' } });
    save();

    await waitFor(() => expect(onSavePoi).toHaveBeenCalledTimes(1));
    expect(onSavePoi.mock.calls[0][0]).toEqual(
      expect.objectContaining({ externalId: 'R-202' }),
    );
  });
});

describe('NodeInspector — aliases', () => {
  test('Enter adds an alias chip and Save submits the whole list', async () => {
    const { onSavePoi } = renderInspector({ aliases: ['apteka'] });

    const input = screen.getByLabelText(en.mapEditor.poiAliases);
    fireEvent.change(input, { target: { value: 'chemist' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('apteka')).toBeInTheDocument();
    expect(screen.getByText('chemist')).toBeInTheDocument();

    save();

    await waitFor(() => expect(onSavePoi).toHaveBeenCalledTimes(1));
    expect(onSavePoi.mock.calls[0][0].aliases).toEqual(['apteka', 'chemist']);
  });

  test('untouched chips are omitted entirely so the names column survives', async () => {
    const { onSavePoi } = renderInspector({ aliases: ['apteka'] });

    fireEvent.change(screen.getByLabelText(en.mapEditor.poiName), {
      target: { value: 'Aversi Pharmacy' },
    });
    save();

    await waitFor(() => expect(onSavePoi).toHaveBeenCalledTimes(1));
    const values = onSavePoi.mock.calls[0][0];
    expect(values.name).toBe('Aversi Pharmacy');
    expect(values.aliases).toBeUndefined();
    expect('aliases' in values).toBe(false);
  });

  test('an alias edit carries the loaded translations along untouched', async () => {
    const { onSavePoi } = renderInspector({
      aliases: ['apteka'],
      nameEn: 'Pharmacy',
      nameKa: 'ფარმაცია',
    });

    const input = screen.getByLabelText(en.mapEditor.poiAliases);
    fireEvent.change(input, { target: { value: 'chemist' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    save();

    await waitFor(() => expect(onSavePoi).toHaveBeenCalledTimes(1));
    const values = onSavePoi.mock.calls[0][0];
    expect(values.aliases).toEqual(['apteka', 'chemist']);
    // Not editable here — echoed back so the server's wholesale `names`
    // replace cannot drop them.
    expect(values.nameEn).toBe('Pharmacy');
    expect(values.nameKa).toBe('ფარმაცია');
  });

  test('clearing every chip is still an edit, so an empty list is submitted', async () => {
    const { onSavePoi } = renderInspector({ aliases: ['apteka'] });

    fireEvent.click(
      screen.getByRole('button', { name: `${en.common.delete} apteka` }),
    );
    save();

    await waitFor(() => expect(onSavePoi).toHaveBeenCalledTimes(1));
    expect(onSavePoi.mock.calls[0][0].aliases).toEqual([]);
  });
});
