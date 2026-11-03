import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Mybuildings from './mybuildings';
import * as buildingApi from '../../apis/building';
import { en } from '../../i18n/messages/en';
import { LanguageProvider } from '../../i18n/LanguageProvider';

/* eslint-disable @typescript-eslint/no-explicit-any */

/* FX-023 (FE-12) — a user invited into someone else's building must be able
   to find it. GET /api/building/my already returns `memberBuildings`; the
   page ignored it, so an invited member saw "No buildings yet". */

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

jest.mock('../../apis/building');
const mockBuilding = buildingApi as jest.Mocked<typeof buildingApi>;

const renderPage = () =>
  render(
    <LanguageProvider>
      <MemoryRouter>
        <Mybuildings />
      </MemoryRouter>
    </LanguageProvider>,
  );

test('lists buildings shared with the user, with their role', async () => {
  mockBuilding.getMyBuildings.mockResolvedValue({
    Success: true,
    Message: [],
    memberBuildings: [
      { _id: 'b9', buildingName: 'Tower', role: 'Fire marshal', permissions: [], floors: 2, maps: [], globalScans: [] },
    ],
  } as any);

  renderPage();

  await waitFor(() => expect(screen.getByText('Tower')).toBeInTheDocument());
  expect(screen.getByText('Fire marshal')).toBeInTheDocument();
  expect(screen.getByText(en.buildings.sharedWithMe)).toBeInTheDocument();
  expect(screen.queryByText(en.buildings.emptyTitle)).not.toBeInTheDocument();
});

test('shows the empty state only when there is nothing owned or shared', async () => {
  mockBuilding.getMyBuildings.mockResolvedValue({ Success: true, Message: [], memberBuildings: [] } as any);

  renderPage();

  await waitFor(() => expect(screen.getByText(en.buildings.emptyTitle)).toBeInTheDocument());
});
