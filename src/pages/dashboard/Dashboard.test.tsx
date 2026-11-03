import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import * as dashboardApi from '../../apis/dashboard';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { en } from '../../i18n/messages/en';

/* FX-067 — the dashboard reads its numbers from `data`, a refusal from `message`. */

jest.mock('../../apis/dashboard');
const mockDashboard = dashboardApi as jest.Mocked<typeof dashboardApi>;

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

const renderDashboard = async () => {
  render(
    <LanguageProvider>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </LanguageProvider>,
  );
  await act(async () => {});
};

test('renders the stats from `data`', async () => {
  mockDashboard.getDashboard.mockResolvedValue({
    success: true,
    message: 'OK',
    data: {
      MyBuildings: 3,
      scanned: 5,
      myBuildingsScanned: 41,
      lastScanned: 'Galleria Tbilisi',
      premiumStatus: 'Free',
      premiumExpires: null,
      recentScans: [],
      scanActivity: [],
    },
  });

  await renderDashboard();

  expect(screen.getByText(en.dashboard.lastScan.replace('{name}', 'Galleria Tbilisi'))).toBeInTheDocument();
  expect(screen.getByText('41')).toBeInTheDocument();
});

test('a refusal shows the server message', async () => {
  mockDashboard.getDashboard.mockResolvedValue({ success: false, message: 'Server error.' });

  await renderDashboard();

  expect(screen.getByRole('alert')).toHaveTextContent('Server error.');
});
