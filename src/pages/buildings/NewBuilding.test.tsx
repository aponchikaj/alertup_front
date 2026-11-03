import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NewBuilding from './NewBuilding';
import * as buildingApi from '../../apis/building';
import * as meApi from '../../apis/me';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { en } from '../../i18n/messages/en';

/* FX-067 — "verified" comes from the /api/me user in `data`; the new building's
   id from the top-level `buildingID`; a refusal's reason from `message`. */

jest.mock('../../apis/building');
jest.mock('../../apis/me');
const mockBuilding = buildingApi as jest.Mocked<typeof buildingApi>;
const mockMe = meApi as jest.Mocked<typeof meApi>;

const navigateMock = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => navigateMock,
}));

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

const renderPage = async () => {
  render(
    <LanguageProvider>
      <MemoryRouter>
        <NewBuilding />
      </MemoryRouter>
    </LanguageProvider>,
  );
  await act(async () => {});
};

const create = async () => {
  fireEvent.change(screen.getByLabelText(new RegExp(en.buildings.buildingName)), { target: { value: 'Depot' } });
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: en.buildings.createCta }).closest('form')!);
  });
};

beforeEach(() => jest.clearAllMocks());

test('an unverified account is asked to verify first', async () => {
  mockMe.getMe.mockResolvedValue({ success: true, message: 'OK', data: { id: 'u1', verified: false } });

  await renderPage();

  expect(screen.getByText(en.buildings.verifyTitle)).toBeInTheDocument();
});

test('a verified account gets the form, and creating opens the editor', async () => {
  mockMe.getMe.mockResolvedValue({ success: true, message: 'OK', data: { id: 'u1', verified: true } });
  mockBuilding.createNewBuilding.mockResolvedValue({ success: true, message: 'Building created successfully.', buildingID: 'b42' });

  await renderPage();
  expect(screen.queryByText(en.buildings.verifyTitle)).not.toBeInTheDocument();
  await create();

  expect(navigateMock).toHaveBeenCalledWith('/building/b42/nodes', { replace: true });
});

test('a refused creation shows the server message', async () => {
  mockMe.getMe.mockResolvedValue({ success: true, message: 'OK', data: { id: 'u1', verified: true } });
  mockBuilding.createNewBuilding.mockResolvedValue({ success: false, message: 'Building name already used.' });

  await renderPage();
  await create();

  expect(screen.getByRole('alert')).toHaveTextContent('Building name already used.');
  expect(navigateMock).not.toHaveBeenCalled();
});

test('a signed-out visitor is sent to log in', async () => {
  mockMe.getMe.mockResolvedValue({ success: false, message: 'Unauthorized.' });

  await renderPage();

  expect(navigateMock).toHaveBeenCalledWith('/login');
});
