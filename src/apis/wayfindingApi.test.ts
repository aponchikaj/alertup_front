import { get } from './http';
import {
  buildRouteParams,
  fetchRoute,
  fetchEvacuationRoute,
  normalizeRoute,
} from './wayfindingApi';
import type { AssembledRoute } from '../components/map/types';

/* ============================================================================
   wayfindingApi contract.
   ----------------------------------------------------------------------------
   buildRouteParams is the pure query-string builder shared by both fetchers;
   these tests assert its exact output so the wire contract with the backend
   (from/to/profile/accessible/heading) never drifts silently. normalizeRoute
   defends the app against a route payload missing the newer optional fields.
   ========================================================================= */

jest.mock('./http', () => ({
  get: jest.fn(),
}));

const mockedGet = get as jest.Mock;

const baseRoute = (): AssembledRoute => ({
  mode: 'WAYFINDING',
  origin: { nodeId: 'n1', label: 'Entrance', floorNumber: 1 },
  destination: { nodeId: 'n2', label: 'Shop', floorNumber: 1, poi: null },
  accessible: false,
  accessibleRouteUnavailable: false,
  totalDistancePx: 100,
  totalDistanceMeters: 10,
  segments: [],
  transitions: [],
  steps: [],
});

describe('buildRouteParams', () => {
  test('legacy call: exact from+to, no accessible/profile/heading', () => {
    const params = buildRouteParams({ fromNodeId: 'n1', toNodeId: 'n2' });

    expect(params.toString()).toBe('from=n1&to=n2');
  });

  test('profile URL omits accessible even when accessible=true is also passed', () => {
    const params = buildRouteParams({
      fromNodeId: 'n1',
      toNodeId: 'n2',
      profile: 'wheelchair',
      accessible: true,
    });

    expect(params.toString()).toBe('from=n1&to=n2&profile=wheelchair');
    expect(params.has('accessible')).toBe(false);
  });

  test('accessible=true sets accessible for back-compat when no profile is given', () => {
    const params = buildRouteParams({ fromNodeId: 'n1', toNodeId: 'n2', accessible: true });

    expect(params.toString()).toBe('from=n1&to=n2&accessible=true');
  });

  test('repeated `to` with poi:/ext:/nodeId encoding from targets', () => {
    const params = buildRouteParams({
      fromNodeId: 'n1',
      targets: [{ poiId: 'p1' }, { externalId: 'EXT-1' }, { nodeId: 'n9' }],
    });

    expect(params.toString()).toBe('from=n1&to=poi%3Ap1&to=ext%3AEXT-1&to=n9');
  });

  test('heading is normalised to a wrapped integer', () => {
    const params = buildRouteParams({ fromNodeId: 'n1', toNodeId: 'n2', heading: 370.6 });

    expect(params.get('heading')).toBe('11');
  });

  test('negative heading wraps into 0-359', () => {
    const params = buildRouteParams({ fromNodeId: 'n1', toNodeId: 'n2', heading: -10 });

    expect(params.get('heading')).toBe('350');
  });

  test('NaN heading is omitted entirely', () => {
    const params = buildRouteParams({ fromNodeId: 'n1', toNodeId: 'n2', heading: NaN });

    expect(params.has('heading')).toBe(false);
  });
});

describe('fetchRoute / fetchEvacuationRoute', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  test('fetchRoute calls the exact legacy URL for a poi destination', async () => {
    mockedGet.mockResolvedValue({ data: { route: baseRoute() } });

    await fetchRoute({ fromNodeId: 'n1', toPoiId: 'p1' });

    expect(mockedGet).toHaveBeenCalledWith(
      '/api/wayfinding/route?from=n1&to=poi%3Ap1',
      { signal: undefined },
    );
  });

  test('fetchEvacuationRoute("n1") calls the exact legacy URL', async () => {
    mockedGet.mockResolvedValue({ data: { route: baseRoute() } });

    await fetchEvacuationRoute('n1');

    expect(mockedGet).toHaveBeenCalledWith(
      '/api/wayfinding/evacuate?from=n1',
      { signal: undefined },
    );
  });

  test('fetchEvacuationRoute passes profile and heading through', async () => {
    mockedGet.mockResolvedValue({ data: { route: baseRoute() } });

    await fetchEvacuationRoute('n1', { profile: 'emergency', heading: 90 });

    expect(mockedGet).toHaveBeenCalledWith(
      '/api/wayfinding/evacuate?from=n1&profile=emergency&heading=90',
      { signal: undefined },
    );
  });
});

describe('normalizeRoute', () => {
  test('fills missing arrays with []', () => {
    const raw = baseRoute();

    const normalized = normalizeRoute(raw);

    expect(normalized.warnings).toEqual([]);
    expect(normalized.alternatives).toEqual([]);
    expect(normalized.closures).toEqual([]);
    expect(normalized.instructions).toEqual([]);
  });

  test('totalDistanceM falls back to totalDistanceMeters when absent', () => {
    const raw = { ...baseRoute(), totalDistanceMeters: 42 };

    expect(normalizeRoute(raw).totalDistanceM).toBe(42);
  });

  test('totalDistanceM is kept when already present', () => {
    const raw = { ...baseRoute(), totalDistanceM: 7, totalDistanceMeters: 42 };

    expect(normalizeRoute(raw).totalDistanceM).toBe(7);
  });

  test('drops instructions without text', () => {
    const raw = {
      ...baseRoute(),
      instructions: [
        { index: 0, kind: 'depart', distanceM: 1, durationSec: 1, segmentIndex: 0, text: { en: 'Go', ka: 'წადი' } },
        { index: 1, kind: 'arrive', distanceM: 0, durationSec: 0, segmentIndex: 0 },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const normalized = normalizeRoute(raw);

    expect(normalized.instructions).toHaveLength(1);
    expect(normalized.instructions?.[0].index).toBe(0);
  });
});
