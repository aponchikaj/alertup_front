import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Logs from './Logs';
import * as administration from '../../apis/administration';
import * as realtime from '../../lib/realtime';
import { LanguageProvider } from '../../i18n/LanguageProvider';

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ============================================================================
   FX-058 — the live log page follows the member feed instead of polling.

   It used to poll every 10 s whether or not anything happened, and reloaded
   the whole page after "clear". It now subscribes to the building's member
   feed: a new log line (or a catch-up signal) refreshes the list at once, and
   the 10 s poll runs only while the live connection is degraded (e.g. Safari
   blocking the cross-site cookie the stream needs).
   ========================================================================= */

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

jest.mock('../../apis/administration');
jest.mock('../../lib/realtime');
const mockAdmin = administration as jest.Mocked<typeof administration>;
const mockRealtime = realtime as jest.Mocked<typeof realtime>;

let handler: (evt: any) => void = () => {};
let statusCb: (s: string) => void = () => {};
let currentStatus = 'open';

beforeEach(() => {
  jest.useFakeTimers();
  mockAdmin.GETBUILDINGLOGS.mockReset().mockResolvedValue({ success: true, message: 'OK', data: [] } as any);
  currentStatus = 'open';
  mockRealtime.createBuildingChannel.mockReturnValue({
    subscribe: (h: any) => {
      handler = h;
      return () => {};
    },
    status: () => currentStatus as any,
    onStatusChange: (cb: any) => {
      statusCb = cb;
      cb(currentStatus);
      return () => {};
    },
    lastHeartbeatAt: () => null,
    lastSeq: () => null,
    close: jest.fn(),
  } as any);
});
afterEach(() => jest.useRealTimers());

const renderLogs = async () => {
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/building/b1/logs']}>
        <Routes>
          <Route path="/building/:buildingId/logs" element={<Logs />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
  await act(async () => {});
};

test('subscribes to the member feed of this building', async () => {
  await renderLogs();
  expect(mockRealtime.createBuildingChannel).toHaveBeenCalledWith('b1', { feed: true });
});

test('a new log line refreshes the list at once', async () => {
  await renderLogs();
  const before = mockAdmin.GETBUILDINGLOGS.mock.calls.length;

  await act(async () => handler({ type: 'log_appended', data: { message: 'x' } }));

  expect(mockAdmin.GETBUILDINGLOGS.mock.calls.length).toBe(before + 1);
});

test('no polling while the live feed is open', async () => {
  await renderLogs();
  const before = mockAdmin.GETBUILDINGLOGS.mock.calls.length;

  await act(async () => {
    jest.advanceTimersByTime(35_000);
  });

  expect(mockAdmin.GETBUILDINGLOGS.mock.calls.length).toBe(before);
});

test('polls every 10 s while the live feed is degraded', async () => {
  await renderLogs();
  await act(async () => statusCb('degraded'));
  const before = mockAdmin.GETBUILDINGLOGS.mock.calls.length;

  await act(async () => {
    jest.advanceTimersByTime(30_000);
  });

  expect(mockAdmin.GETBUILDINGLOGS.mock.calls.length).toBeGreaterThanOrEqual(before + 3);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

/* FX-067 — log lines come from `data`; a failure's reason from `message`. */

test('renders the log lines from `data`', async () => {
  mockAdmin.GETBUILDINGLOGS.mockResolvedValue({
    success: true,
    message: 'OK',
    data: [{ id: 'l1', logType: 'scan', logMessage: 'Floor 2 scanned', buildingID: 'b1', isEmergency: true, createdAt: '2026-01-01T10:00:00Z' }],
  });

  await renderLogs();

  expect(screen.getByText('Floor 2 scanned')).toBeInTheDocument();
});

test('a 200 failure shows the server reason', async () => {
  mockAdmin.GETBUILDINGLOGS.mockResolvedValue({ success: false, message: 'Emergency mode is off.' });

  await renderLogs();

  expect(screen.getByText('Emergency mode is off.')).toBeInTheDocument();
});
