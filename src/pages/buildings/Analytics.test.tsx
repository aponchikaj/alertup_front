import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AnalyticsPage from './Analytics';
import EmergencyAnalytics from './EmergencyAnalytics';
import * as administration from '../../apis/administration';
import { LanguageProvider } from '../../i18n/LanguageProvider';

/* ============================================================================
   FX-067 — both analytics screens read their records from `data` and show a
   refusal's `message`. Records are keyed by `id` (the API module renames the
   wire's `_id`), so the per-emergency link must carry it.
   ========================================================================= */

jest.mock('../../apis/administration');
jest.mock('../../components/ai/AgentChatPanel', () => ({ AgentChatPanel: () => null }));
const mockAdmin = administration as jest.Mocked<typeof administration>;

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

const emergency = {
  id: 'e7', buildingID: 'b1', isFinished: true, scanned: 12, evacuated: 9, calledEmergency: 1,
  startedAt: '2026-01-01T10:00:00Z', endedAt: '2026-01-01T11:00:00Z',
  createdAt: '2026-01-01T10:00:00Z', updatedAt: '2026-01-01T11:00:00Z',
};

const renderAt = async (path: string, routePath: string, element: React.ReactNode) => {
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
  await act(async () => {});
};

describe('analytics list', () => {
  const renderList = () => renderAt('/building/b1/analytics', '/building/:buildingId/analytics', <AnalyticsPage />);

  test('links each emergency from `data` by its id', async () => {
    mockAdmin.GET_BUILDING_ANALYTICS.mockResolvedValue({ success: true, message: 'OK', data: [emergency] });

    await renderList();

    const link = document.querySelector('a[href="/building/b1/e7/analytics"]');
    expect(link).not.toBeNull();
  });

  test('a refusal shows the server message', async () => {
    mockAdmin.GET_BUILDING_ANALYTICS.mockResolvedValue({ success: false, message: 'Server error.' });

    await renderList();

    expect(screen.getByRole('alert')).toHaveTextContent('Server error.');
  });
});

describe('single emergency report', () => {
  const renderReport = () =>
    renderAt('/building/b1/e7/analytics', '/building/:buildingId/:emergencyId/analytics', <EmergencyAnalytics />);

  test('renders the incident log from `data`', async () => {
    mockAdmin.GET_EMERGENCY_DATA.mockResolvedValue({
      success: true,
      message: 'OK',
      data: {
        emergency,
        logs: [{ id: 'l1', logType: 'scan', logMessage: 'Visitor scanned floor 2', buildingID: 'b1', isEmergency: true, createdAt: '2026-01-01T10:05:00Z' }],
      },
    });

    await renderReport();

    expect(mockAdmin.GET_EMERGENCY_DATA).toHaveBeenCalledWith({ buildingID: 'b1', emergencyID: 'e7' });
    expect(screen.getByText('Visitor scanned floor 2')).toBeInTheDocument();
  });

  test('a refusal shows the server message', async () => {
    mockAdmin.GET_EMERGENCY_DATA.mockResolvedValue({ success: false, message: 'Logs not found.' });

    await renderReport();

    expect(screen.getByRole('alert')).toHaveTextContent('Logs not found.');
  });
});
