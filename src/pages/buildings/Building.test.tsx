import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { act } from '@testing-library/react';
import Building from './Building';
import * as buildingApi from '../../apis/building';
import { en } from '../../i18n/messages/en';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { ToastProvider } from '../../components/ui/Toast';

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ============================================================================
   FX-023 — the building page shows each control to whoever may use it.

   It used to decode the session JWT by hand and show the emergency switch,
   the map editor and analytics to the OWNER only — so a member the owner had
   granted CAN_TRIGGER_EMERGENCY (a fire marshal) could not reach the switch
   the API would have accepted from them. Controls now follow permissions.
   ========================================================================= */

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

jest.mock('../../apis/building');
jest.mock('../../auth/useAuth', () => ({
  __esModule: true,
  useAuth: () => (globalThis as any).__authState,
  default: () => (globalThis as any).__authState,
}));

const mockBuilding = buildingApi as jest.Mocked<typeof buildingApi>;
const BUILDING_ID = 'b1';

const auth = (overrides: Record<string, unknown>) => {
  (globalThis as any).__authState = {
    status: 'authed',
    user: { id: 'u-me' },
    memberships: {},
    ownedBuildingIds: [],
    error: '',
    refresh: jest.fn(),
    ...overrides,
  };
};

const renderPage = () =>
  render(
    <LanguageProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/building/${BUILDING_ID}`]}>
          <Routes>
            <Route path="/building/:buildingId" element={<Building />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </LanguageProvider>,
  );

beforeEach(() => {
  mockBuilding.getBuilding.mockResolvedValue({
    success: true,
    message: 'OK',
    data: { id: BUILDING_ID, buildingName: 'Tower', owner: 'u-owner', emergencyMode: false, maps: [] },
    Owner: { _id: 'u-owner', displayName: 'Nino', userType: 'Individual' },
  } as any);
});

test('a fire marshal (CAN_TRIGGER_EMERGENCY) sees the emergency switch but not the map editor', async () => {
  auth({ memberships: { [BUILDING_ID]: { role: 'Fire marshal', permissions: ['CAN_TRIGGER_EMERGENCY'] } } });

  renderPage();

  await waitFor(() => expect(screen.getByText(en.emergency.trigger)).toBeInTheDocument());
  expect(screen.queryByText(en.buildings.mapEditor)).not.toBeInTheDocument();
});

test('an editor (CAN_EDIT_MAP) sees the map editor but not the emergency switch', async () => {
  auth({ memberships: { [BUILDING_ID]: { role: 'Editor', permissions: ['CAN_EDIT_MAP'] } } });

  renderPage();

  await waitFor(() => expect(screen.getByText(en.buildings.mapEditor)).toBeInTheDocument());
  expect(screen.queryByText(en.emergency.trigger)).not.toBeInTheDocument();
});

test('the owner sees every control', async () => {
  auth({ ownedBuildingIds: [BUILDING_ID] });

  renderPage();

  await waitFor(() => expect(screen.getByText(en.emergency.trigger)).toBeInTheDocument());
  expect(screen.getByText(en.buildings.mapEditor)).toBeInTheDocument();
  expect(screen.getByText(en.buildings.analytics)).toBeInTheDocument();
});

test('a signed-in stranger sees none of them', async () => {
  auth({});

  renderPage();

  await waitFor(() => expect(screen.getByText('Tower')).toBeInTheDocument());
  expect(screen.queryByText(en.emergency.trigger)).not.toBeInTheDocument();
  expect(screen.queryByText(en.buildings.mapEditor)).not.toBeInTheDocument();
  expect(screen.queryByText(en.buildings.analytics)).not.toBeInTheDocument();
});

// FX-098: switching buildings while the first one is still loading must not
// let the late answer overwrite the page with the previous building.
test('a slow response for the previous building never overwrites the current one', async () => {
  auth({});
  let resolveA: (v: unknown) => void = () => {};
  mockBuilding.getBuilding.mockImplementation(({ buildingID }: { buildingID: string }) =>
    buildingID === 'bA'
      ? (new Promise((r) => { resolveA = r; }) as any)
      : Promise.resolve({
          success: true,
          message: 'OK',
          data: { id: 'bB', buildingName: 'Tower B', owner: 'x', emergencyMode: false, maps: [] },
        } as any),
  );
  const GoToB = () => {
    const navigate = useNavigate();
    return <button onClick={() => navigate('/building/bB')}>go-b</button>;
  };

  render(
    <LanguageProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/building/bA']}>
          <GoToB />
          <Routes>
            <Route path="/building/:buildingId" element={<Building />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </LanguageProvider>,
  );

  act(() => screen.getByText('go-b').click());
  await waitFor(() => expect(screen.getByText('Tower B')).toBeInTheDocument());
  await act(async () => {
    resolveA({
      success: true,
      message: 'OK',
      data: { id: 'bA', buildingName: 'Tower A', owner: 'x', emergencyMode: false, maps: [] },
    });
  });

  expect(screen.queryByText('Tower A')).not.toBeInTheDocument();
  expect(screen.getByText('Tower B')).toBeInTheDocument();
});

/* ============================================================================
   FX-067 — the building comes from `data`; `message` is only ever text.
   ========================================================================= */

test('renders the building from `data` and the owner from the top-level Owner', async () => {
  auth({});

  renderPage();

  expect(await screen.findByText('Tower')).toBeInTheDocument();
  expect(screen.getByText('Nino')).toBeInTheDocument();
});

test('a failure shows the server message instead of a building', async () => {
  auth({});
  mockBuilding.getBuilding.mockResolvedValue({ success: false, message: 'Building not found.' });

  renderPage();

  expect(await screen.findByText('Building not found.')).toBeInTheDocument();
  expect(screen.queryByText('Tower')).not.toBeInTheDocument();
});

test('links use the building `id`', async () => {
  auth({ ownedBuildingIds: [BUILDING_ID] });

  renderPage();

  const editor = await screen.findByText(en.buildings.mapEditor);
  expect(editor.closest('a')).toHaveAttribute('href', `/building/${BUILDING_ID}/nodes`);
});

// Bug found during FX-067: `scanned` is a count, but the page read
// `scanned.length`, so every floor showed 0 scans.
test('each floor shows its scan count', async () => {
  auth({});
  mockBuilding.getBuilding.mockResolvedValue({
    success: true,
    message: 'OK',
    data: {
      id: BUILDING_ID, buildingName: 'Tower', owner: 'u-owner', emergencyMode: false,
      maps: [{ floor: '1', map: null, qrCode: null, scanned: 7, createdAt: '2026-01-01' }],
    },
  } as any);

  renderPage();

  expect(await screen.findByText(`${en.buildings.scannedCount}: 7`)).toBeInTheDocument();
});

test('a named floor shows its name; a numbered one gets the "Floor N" label', async () => {
  auth({});
  mockBuilding.getBuilding.mockResolvedValue({
    success: true,
    message: 'OK',
    data: {
      id: BUILDING_ID, buildingName: 'Tower', owner: 'u-owner', emergencyMode: false,
      maps: [
        { floor: 'Ground', map: null, qrCode: null, scanned: 0, createdAt: '2026-01-01' },
        { floor: '2', map: null, qrCode: null, scanned: 0, createdAt: '2026-01-01' },
      ],
    },
  } as any);

  renderPage();

  expect(await screen.findByText('Ground')).toBeInTheDocument();
  expect(screen.queryByText('Floor Ground')).not.toBeInTheDocument();
  expect(screen.getByText('Floor 2')).toBeInTheDocument();
});
