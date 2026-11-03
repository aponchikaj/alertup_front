import { act, render, screen } from '@testing-library/react';
import EmergencyProvider from './EmergencyProvider';
import { useEmergency } from './useEmergency';
import * as realtime from '../lib/realtime';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('../lib/realtime');
const mockRealtime = realtime as jest.Mocked<typeof realtime>;

// One handler per building, so a test can push frames into a specific channel.
const handlers = new Map<string, (e: any) => void>();

beforeEach(() => {
  handlers.clear();
  mockRealtime.createBuildingChannel.mockImplementation((buildingId: string) => ({
    subscribe: (h: any) => {
      handlers.set(buildingId, h);
      return () => handlers.delete(buildingId);
    },
    status: () => 'open' as any,
    onStatusChange: (cb: any) => {
      cb('open');
      return () => {};
    },
    lastHeartbeatAt: () => null,
    lastSeq: () => null,
    close: jest.fn(),
  }) as any);
});

const Probe = () => {
  const e = useEmergency();
  return (
    <div>
      <span data-testid="phase">{e?.phase}</span>
      <span data-testid="emergencyId">{e?.emergencyId ?? ''}</span>
      <span data-testid="logs">{e?.logs.length}</span>
    </div>
  );
};

const ui = (buildingId: string) => (
  <EmergencyProvider buildingId={buildingId} feed>
    <Probe />
  </EmergencyProvider>
);

test('switching building drops the previous building emergency and logs', () => {
  const { rerender } = render(ui('A'));
  act(() => {
    handlers.get('A')!({
      type: 'emergency_started',
      data: { emergencyId: 'em-A', message: 'Fire in A', startedAt: '2026-11-03T10:00:00Z' },
    });
    handlers.get('A')!({
      type: 'log_appended',
      data: { id: 'l1', message: 'x', type: 'info', createdAt: '2026-11-03T10:00:01Z' },
    });
  });
  expect(screen.getByTestId('phase').textContent).toBe('emergency');
  expect(screen.getByTestId('logs').textContent).toBe('1');

  rerender(ui('B'));

  // B has sent nothing yet: it must not show A's emergency or A's logs.
  expect(screen.getByTestId('emergencyId').textContent).toBe('');
  expect(screen.getByTestId('phase').textContent).toBe('unknown');
  expect(screen.getByTestId('logs').textContent).toBe('0');
  expect(mockRealtime.createBuildingChannel).toHaveBeenLastCalledWith('B', { feed: true });
});
