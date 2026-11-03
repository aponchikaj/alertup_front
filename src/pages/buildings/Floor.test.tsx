import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Floor from './Floor';
import * as buildingApi from '../../apis/building';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { en } from '../../i18n/messages/en';

/* FX-067 — the floor view reads its payload from `data`, a refusal from `message`. */

jest.mock('../../apis/building');
const mockBuilding = buildingApi as jest.Mocked<typeof buildingApi>;

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

const renderFloor = async () => {
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/building/b1/2']}>
        <Routes>
          <Route path="/building/:buildingId/:floor" element={<Floor />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
  await act(async () => {});
};

test('renders the floor from `data`', async () => {
  mockBuilding.getFloor.mockResolvedValue({
    success: true,
    message: 'OK',
    data: {
      buildingName: 'Tbilisi Mall',
      floorData: { floor: 'Second', map: null, qrCode: null, scanned: 4, createdAt: '2026-01-01' },
      scannedCount: 4,
    },
  });

  await renderFloor();

  expect(mockBuilding.getFloor).toHaveBeenCalledWith({ id: 'b1', floor: '2' });
  expect(screen.getByText(/Tbilisi Mall/)).toBeInTheDocument();
  expect(screen.getByText(en.buildings.scannedCount)).toBeInTheDocument();
});

test('a refusal shows the server message', async () => {
  mockBuilding.getFloor.mockResolvedValue({ success: false, message: 'Floor not found.' });

  await renderFloor();

  expect(screen.getByRole('alert')).toHaveTextContent('Floor not found.');
});

test('a success without a floor reports the floor as unavailable', async () => {
  mockBuilding.getFloor.mockResolvedValue({ success: true, message: 'OK' });

  await renderFloor();

  expect(screen.getByRole('alert')).toHaveTextContent(en.buildings.floorLoadFailed);
});
