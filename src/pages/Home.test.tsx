import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import * as contactApi from '../apis/contact';
import * as meApi from '../apis/me';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { en } from '../i18n/messages/en';

/* FX-067 — the landing page reads `success` from /api/me to pick its call to
   action, and shows the server's `message` when the contact form is refused. */

jest.mock('../apis/contact');
jest.mock('../apis/me');
jest.mock('../theme/useTheme', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));
jest.mock('../seo/Seo', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/qr/Scanner', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/ai/ProductAiWidget', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/ai/AiDemo', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/marketing/Reviews', () => ({ __esModule: true, default: () => null }));

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

const mockContact = contactApi as jest.Mocked<typeof contactApi>;
const mockMe = meApi as jest.Mocked<typeof meApi>;

const renderHome = async () => {
  render(
    <LanguageProvider>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </LanguageProvider>,
  );
  await act(async () => {});
};

beforeEach(() => jest.clearAllMocks());

test('a signed-in visitor is offered the dashboard', async () => {
  mockMe.getMe.mockResolvedValue({ success: true, message: 'OK', data: { id: 'u1' } });

  await renderHome();

  expect(screen.getByText(en.common.openDashboard)).toBeInTheDocument();
});

test('a guest is offered sign-up', async () => {
  mockMe.getMe.mockResolvedValue({ success: false, message: 'Unauthorized.' });

  await renderHome();

  expect(screen.queryByText(en.common.openDashboard)).not.toBeInTheDocument();
  expect(screen.getAllByText(en.common.getStartedFree).length).toBeGreaterThan(0);
});

test('a refused contact message shows the server reason', async () => {
  mockMe.getMe.mockResolvedValue({ success: false, message: 'Unauthorized.' });
  mockContact.ContactAPI.mockResolvedValue({ success: false, message: 'Too many messages.' });

  await renderHome();
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: en.common.send }).closest('form')!);
  });

  expect(screen.getByRole('alert')).toHaveTextContent('Too many messages.');
});
