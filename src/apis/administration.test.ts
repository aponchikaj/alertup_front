import { get, post } from './http';
import {
  GET_BUILDING_ANALYTICS,
  GET_EMERGENCY_DATA,
  GETBUILDINGLOGS,
  setEmergencyMode,
} from './administration';

/* ============================================================================
   FX-018 — the emergency switch states its intent.

   The old client POSTed to a TOGGLE: the server read the building's current
   state and flipped it. A page left open with a stale "off" banner, tapped
   "activate" while an emergency was already live, RESOLVED that emergency.
   The switch now calls the explicit v2 route for what the button says it
   does; trigger is idempotent, so a stale "activate" can never end an
   evacuation.
   ========================================================================= */

jest.mock('./http', () => {
  const actual = jest.requireActual('./http');
  return { ...actual, get: jest.fn(), post: jest.fn() };
});

const mockedGet = get as jest.Mock;
const mockedPost = post as jest.Mock;
const challenge = { token: 't', answer: 7 };

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
});

test('activating calls the v2 trigger route, never the legacy toggle', async () => {
  mockedPost.mockResolvedValue({ success: true, message: 'Emergency activated.', data: { alreadyActive: false, emergencyId: 'e1' } });

  const res = await setEmergencyMode('b1', 'activate', challenge);

  expect(res.success).toBe(true);
  expect(res.data).toEqual({ alreadyActive: false, emergencyId: 'e1' });
  expect(mockedPost).toHaveBeenCalledTimes(1);
  const [url, body] = mockedPost.mock.calls[0];
  expect(url).toMatch(/\/api\/emergency\/buildings\/b1\/trigger$/);
  expect(body).toEqual({ challenge });
});

test('resolving calls the v2 resolve route', async () => {
  mockedPost.mockResolvedValue({ success: true, message: 'Emergency resolved.', data: { alreadyResolved: false } });

  await setEmergencyMode('b1', 'resolve', challenge);

  expect(mockedPost.mock.calls[0][0]).toMatch(/\/api\/emergency\/buildings\/b1\/resolve$/);
});

test('a server rejection comes back as { success:false, message }', async () => {
  mockedPost.mockRejectedValue(new Error('CHALLENGE_FAILED'));

  const res = await setEmergencyMode('b1', 'activate', challenge);

  expect(res).toEqual({ success: false, message: 'CHALLENGE_FAILED' });
});

/* ============================================================================
   Logs and emergencies still arrive keyed by the Mongo-era `_id`; the module
   hands screens `id`, and leaves a failure's text in `message`.
   ========================================================================= */

const wireLog = { _id: 'l1', logType: 'scan', logMessage: 'Scanned floor 1', buildingID: 'b1', isEmergency: true, createdAt: '2026-01-01' };
const wireEmergency = {
  _id: 'e1', buildingID: 'b1', isFinished: true, scanned: 3, evacuated: 2, calledEmergency: 0,
  startedAt: '2026-01-01', endedAt: '2026-01-02', createdAt: '2026-01-01', updatedAt: '2026-01-02',
};

test('building logs come back with `id`', async () => {
  mockedGet.mockResolvedValue({ success: true, message: 'OK', data: [wireLog] });

  const res = await GETBUILDINGLOGS('b1');

  expect(res.success).toBe(true);
  expect(res.data).toEqual([
    { id: 'l1', logType: 'scan', logMessage: 'Scanned floor 1', buildingID: 'b1', isEmergency: true, createdAt: '2026-01-01' },
  ]);
});

test('a 200 failure on logs keeps its reason in `message` and carries no data', async () => {
  mockedGet.mockResolvedValue({ success: false, message: 'Emergency mode is off.' });

  const res = await GETBUILDINGLOGS('b1');

  expect(res).toEqual({ success: false, message: 'Emergency mode is off.' });
});

test('the analytics list re-keys every emergency', async () => {
  mockedGet.mockResolvedValue({ success: true, message: 'OK', data: [wireEmergency] });

  const res = await GET_BUILDING_ANALYTICS('b1', { dateFrom: undefined });

  expect(res.data?.[0].id).toBe('e1');
  expect(res.data?.[0]).not.toHaveProperty('_id');
  expect(res.data?.[0].evacuated).toBe(2);
});

test('an emergency report re-keys the emergency and its logs', async () => {
  mockedGet.mockResolvedValue({ success: true, message: 'OK', data: { logs: [wireLog], emergency: wireEmergency } });

  const res = await GET_EMERGENCY_DATA({ buildingID: 'b1', emergencyID: 'e1' });

  expect(res.data?.emergency.id).toBe('e1');
  expect(res.data?.logs[0].id).toBe('l1');
  expect(res.data?.logs[0].logMessage).toBe('Scanned floor 1');
});
