import { act, render, screen } from '@testing-library/react';
import ServerGate from './loading';
import { ConnectApis } from '../../apis/connect';

/* ============================================================================
   FX-021 — the API being down must not take the whole site down with it.

   ServerGate used to hold EVERY route — home, legal pages, the QR scan page —
   behind a full-screen "Connecting…" spinner for up to ~6 s of retries, and
   then replace them with a developer error screen. With the backend down
   (as on 2026-11-03), visitors saw nothing at all. Pages now render at once;
   an unreachable API is a banner, not a wall.
   ========================================================================= */

jest.mock('../../apis/connect', () => ({ ConnectApis: jest.fn() }));
const mockedConnect = ConnectApis as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  mockedConnect.mockReset();
});
afterEach(() => jest.useRealTimers());

const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });
  }
};

test('renders the page immediately while the server check is still running', () => {
  mockedConnect.mockReturnValue(new Promise(() => {}));

  render(<ServerGate><p>page content</p></ServerGate>);

  expect(screen.getByText('page content')).toBeInTheDocument();
});

test('keeps the page and shows a banner when the server is unreachable', async () => {
  mockedConnect.mockResolvedValue({ Success: false, Message: 'down' });

  render(<ServerGate><p>page content</p></ServerGate>);
  await flush();

  expect(screen.getByText('page content')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent(/can.t reach/i);
});

test('shows no banner when the server answers', async () => {
  mockedConnect.mockResolvedValue({ Success: true });

  render(<ServerGate><p>page content</p></ServerGate>);
  await flush();

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
