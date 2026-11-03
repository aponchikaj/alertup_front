import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Mybuildings from './Mybuildings';
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
    success: true,
    message: 'OK',
    data: [],
    memberBuildings: [
      { id: 'b9', buildingName: 'Tower', role: 'Fire marshal', permissions: [], floors: 2, maps: [], globalScans: [] },
    ],
  } as any);

  renderPage();

  await waitFor(() => expect(screen.getByText('Tower')).toBeInTheDocument());
  expect(screen.getByText('Fire marshal')).toBeInTheDocument();
  expect(screen.getByText('Tower').closest('a')).toHaveAttribute('href', '/building/b9');
  expect(screen.getByText(en.buildings.sharedWithMe)).toBeInTheDocument();
  expect(screen.queryByText(en.buildings.emptyTitle)).not.toBeInTheDocument();
});

test('shows the empty state only when there is nothing owned or shared', async () => {
  mockBuilding.getMyBuildings.mockResolvedValue({ success: true, message: 'OK', data: [], memberBuildings: [] } as any);

  renderPage();

  await waitFor(() => expect(screen.getByText(en.buildings.emptyTitle)).toBeInTheDocument());
});

/* FX-067 — owned buildings come from `data`, failures from `message`. */

const owned = {
  id: 'b1', buildingName: 'Mall', owner: 'u1', floors: 3, maps: [], globalScans: [],
  emergencyMode: false, isDeactivated: false, createdAt: '', updatedAt: '',
};

test('lists the owned buildings from `data`, linked by id', async () => {
  mockBuilding.getMyBuildings.mockResolvedValue({ success: true, message: 'OK', data: [owned], memberBuildings: [] });

  renderPage();

  const name = await screen.findByText('Mall');
  expect(name.closest('a')).toHaveAttribute('href', '/building/b1');
});

test('a failure shows the server message', async () => {
  mockBuilding.getMyBuildings.mockResolvedValue({ success: false, message: 'Server error' });

  renderPage();

  expect(await screen.findByText('Server error')).toBeInTheDocument();
});

test('deleting removes the building by id; a refusal alerts the server text', async () => {
  mockBuilding.getMyBuildings.mockResolvedValue({
    success: true, message: 'OK', data: [owned, { ...owned, id: 'b2', buildingName: 'Depot' }], memberBuildings: [],
  });
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

  renderPage();
  await screen.findByText('Mall');

  mockBuilding.deleteBuilding.mockResolvedValueOnce({ success: false, message: 'Only the owner can delete.' });
  await act(async () => screen.getAllByRole('button', { name: en.common.delete })[0].click());
  expect(alertSpy).toHaveBeenCalledWith('Only the owner can delete.');
  expect(screen.getByText('Mall')).toBeInTheDocument();

  mockBuilding.deleteBuilding.mockResolvedValueOnce({ success: true, message: 'Deleted.' });
  await act(async () => screen.getAllByRole('button', { name: en.common.delete })[0].click());
  expect(mockBuilding.deleteBuilding).toHaveBeenLastCalledWith('b1');
  await waitFor(() => expect(screen.queryByText('Mall')).not.toBeInTheDocument());
  expect(screen.getByText('Depot')).toBeInTheDocument();
});
