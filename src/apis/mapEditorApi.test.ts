import { get, post, put, del } from './http';
import {
  toEditorEdge,
  toEditorPoi,
  savePoi,
  createClosure,
  deleteClosure,
} from './mapEditorApi';
import type { RawEdge, RawPoi } from './mapEditorApi';

/* ============================================================================
   mapEditorApi contract — F11 additions.
   ----------------------------------------------------------------------------
   Four things this task must get right:
     1. an edge with no `direction`/`tags` column (rows from before those
        columns existed) degrades to BOTH/[] rather than undefined.
     2. a POI's externalId/aliases round-trip through the mapper, and a save
        that doesn't touch them must not send a body that clears them.
     3. createClosure's body carries the `costMultiplier: null` BLOCKED
        sentinel explicitly rather than dropping the field.
     4. deleteClosure hits the exact building-scoped closure path.
   ========================================================================= */

jest.mock('./http', () => {
  const actual = jest.requireActual('./http');
  return {
    ...actual,
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    del: jest.fn(),
    request: jest.fn(),
  };
});

const mockedGet = get as jest.Mock;
const mockedPost = post as jest.Mock;
const mockedPut = put as jest.Mock;
const mockedDel = del as jest.Mock;

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
  mockedPut.mockReset();
  mockedDel.mockReset();
});

const baseRawEdge = (): RawEdge => ({
  id: 'e1',
  sourceNodeId: 'n1',
  targetNodeId: 'n2',
  buildingId: 'b1',
  distance: 10,
  weight: 10,
  accessible: true,
  transitType: 'WALKWAY',
});

describe('edge defaults', () => {
  test('toEditorEdge defaults a missing direction to BOTH and a missing tags to []', () => {
    const edge = toEditorEdge(baseRawEdge());

    expect(edge.direction).toBe('BOTH');
    expect(edge.tags).toEqual([]);
  });

  test('toEditorEdge degrades an unrecognised direction to BOTH but keeps real tags', () => {
    const edge = toEditorEdge({
      ...baseRawEdge(),
      direction: 'SIDEWAYS',
      tags: ['stroller', 'staff_only'],
    });

    expect(edge.direction).toBe('BOTH');
    expect(edge.tags).toEqual(['stroller', 'staff_only']);
  });

  test('toEditorEdge passes FORWARD/REVERSE through unchanged', () => {
    expect(toEditorEdge({ ...baseRawEdge(), direction: 'FORWARD' }).direction).toBe('FORWARD');
    expect(toEditorEdge({ ...baseRawEdge(), direction: 'REVERSE' }).direction).toBe('REVERSE');
  });
});

describe('POI externalId/aliases', () => {
  const baseRawPoi = (): RawPoi => ({
    id: 'p1',
    nodeId: 'n1',
    name: 'Cafe',
    category: null,
    description: null,
    keywords: [],
  });

  test('toEditorPoi maps externalId and names.aliases, defaulting both when absent', () => {
    const withNames = toEditorPoi({
      ...baseRawPoi(),
      externalId: 'SKU-1',
      names: { en: 'Cafe', aliases: ['Coffee Bar'] },
    });
    expect(withNames.externalId).toBe('SKU-1');
    expect(withNames.aliases).toEqual(['Coffee Bar']);

    const withoutNames = toEditorPoi(baseRawPoi());
    expect(withoutNames.externalId).toBeUndefined();
    expect(withoutNames.aliases).toEqual([]);
  });

  test('savePoi omits externalId and names entirely when the caller does not set them', async () => {
    mockedPut.mockResolvedValue({ success: true, data: { poi: baseRawPoi() } });

    await savePoi('n1', { buildingId: 'b1', name: 'Cafe' });

    const [, body] = mockedPut.mock.calls[0] as [string, Record<string, unknown>];
    expect(body).not.toHaveProperty('externalId');
    expect(body).not.toHaveProperty('names');
  });

  test('toEditorPoi carries the localized names, so a later save can echo them back', () => {
    const poi = toEditorPoi({
      ...baseRawPoi(),
      names: { en: 'Pharmacy', ka: 'ფარმაცია', aliases: ['apteka'] },
    });
    expect(poi.nameEn).toBe('Pharmacy');
    expect(poi.nameKa).toBe('ფარმაცია');

    const bare = toEditorPoi(baseRawPoi());
    expect(bare.nameEn).toBeUndefined();
    expect(bare.nameKa).toBeUndefined();
  });

  test('savePoi echoes the loaded en/ka back whenever it sends names', async () => {
    mockedPut.mockResolvedValue({ success: true, data: { poi: baseRawPoi() } });

    await savePoi('n1', {
      buildingId: 'b1',
      name: 'Cafe',
      aliases: ['apteka', 'chemist'],
      nameEn: 'Pharmacy',
      nameKa: 'ფარმაცია',
    });

    const [, body] = mockedPut.mock.calls[0] as [string, Record<string, unknown>];
    // The server replaces the whole `names` column, so an alias-only edit has
    // to resend the translations it loaded or they are gone.
    expect(body.names).toEqual({
      aliases: ['apteka', 'chemist'],
      en: 'Pharmacy',
      ka: 'ფარმაცია',
    });
  });

  test('clearing every alias on a translated POI keeps the translations alive', async () => {
    mockedPut.mockResolvedValue({ success: true, data: { poi: baseRawPoi() } });

    await savePoi('n1', {
      buildingId: 'b1',
      name: 'Cafe',
      aliases: [],
      nameKa: 'ფარმაცია',
    });

    const [, body] = mockedPut.mock.calls[0] as [string, Record<string, unknown>];
    // `{aliases: []}` alone parses to null server-side and nulls the column;
    // the ka key is what keeps it a real object.
    expect(body.names).toEqual({ aliases: [], ka: 'ფარმაცია' });
  });

  test('savePoi sends aliases under names and lets an explicit null clear externalId', async () => {
    mockedPut.mockResolvedValue({ success: true, data: { poi: baseRawPoi() } });

    await savePoi('n1', {
      buildingId: 'b1',
      name: 'Cafe',
      externalId: null,
      aliases: ['Coffee Bar'],
    });

    const [, body] = mockedPut.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.externalId).toBeNull();
    expect(body.names).toEqual({ aliases: ['Coffee Bar'] });
  });
});

describe('createClosure body', () => {
  test('sends costMultiplier: null explicitly rather than omitting the BLOCKED sentinel', async () => {
    mockedPost.mockResolvedValue({
      success: true,
      data: {
        closure: {
          id: 'c1',
          floorId: null,
          edgeIds: ['e1'],
          nodeIds: [],
          costMultiplier: null,
          reason: 'Spill',
          startsAt: '2026-01-01T00:00:00.000Z',
          endsAt: null,
          blocked: true,
        },
      },
    });

    await createClosure('b1', { edgeIds: ['e1'], costMultiplier: null, reason: 'Spill' });

    expect(mockedPost).toHaveBeenCalledWith(
      '/api/map-editor/buildings/b1/closures',
      { edgeIds: ['e1'], costMultiplier: null, reason: 'Spill' },
    );
  });

  test('a penalty multiplier is sent as a plain number, not the sentinel', async () => {
    mockedPost.mockResolvedValue({
      success: true,
      data: {
        closure: {
          id: 'c2',
          floorId: null,
          edgeIds: ['e1'],
          nodeIds: [],
          costMultiplier: 3,
          reason: null,
          startsAt: '2026-01-01T00:00:00.000Z',
          endsAt: null,
          blocked: false,
        },
      },
    });

    const closure = await createClosure('b1', { edgeIds: ['e1'], costMultiplier: 3 });

    expect(mockedPost).toHaveBeenCalledWith(
      '/api/map-editor/buildings/b1/closures',
      { edgeIds: ['e1'], costMultiplier: 3 },
    );
    expect(closure.blocked).toBe(false);
    expect(closure.costMultiplier).toBe(3);
  });
});

describe('deleteClosure path', () => {
  test('DELETEs the exact building-scoped closure path', async () => {
    mockedDel.mockResolvedValue({ success: true, data: { closureId: 'c1' } });

    await deleteClosure('b1', 'c1');

    expect(mockedDel).toHaveBeenCalledWith(
      '/api/map-editor/buildings/b1/closures/c1',
    );
  });

  test('encodes ids that need it', async () => {
    mockedDel.mockResolvedValue({ success: true, data: { closureId: 'c/1' } });

    await deleteClosure('b 1', 'c/1');

    expect(mockedDel).toHaveBeenCalledWith(
      '/api/map-editor/buildings/b%201/closures/c%2F1',
    );
  });
});
