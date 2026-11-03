import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Building from './building';
import * as buildingApi from '../../apis/building';
import { en } from '../../i18n/messages/en';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { ToastProvider } from '../../components/ui/toast';

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
            <Route path="/building/:buildingID" element={<Building />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </LanguageProvider>,
  );

beforeEach(() => {
  mockBuilding.getBuilding.mockResolvedValue({
    Success: true,
    Message: { _id: BUILDING_ID, buildingName: 'Tower', owner: 'u-owner', emergencyMode: false, maps: [] },
    Owner: { name: 'Nino' },
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
