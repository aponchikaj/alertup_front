import { post } from './http';
import { setEmergencyMode } from './administration';

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
  return { ...actual, post: jest.fn() };
});

const mockedPost = post as jest.Mock;
const challenge = { token: 't', answer: 7 };

beforeEach(() => mockedPost.mockReset());

test('activating calls the v2 trigger route, never the legacy toggle', async () => {
  mockedPost.mockResolvedValue({ Success: true, Message: { alreadyActive: false } });

  const res = await setEmergencyMode('b1', 'activate', challenge);

  expect(res.Success).toBe(true);
  expect(mockedPost).toHaveBeenCalledTimes(1);
  const [url, body] = mockedPost.mock.calls[0];
  expect(url).toMatch(/\/api\/emergency\/buildings\/b1\/trigger$/);
  expect(body).toEqual({ challenge });
});

test('resolving calls the v2 resolve route', async () => {
  mockedPost.mockResolvedValue({ Success: true, Message: { alreadyResolved: false } });

  await setEmergencyMode('b1', 'resolve', challenge);

  expect(mockedPost.mock.calls[0][0]).toMatch(/\/api\/emergency\/buildings\/b1\/resolve$/);
});

test('a server rejection comes back as { Success:false, Message }', async () => {
  mockedPost.mockRejectedValue(new Error('CHALLENGE_FAILED'));

  const res = await setEmergencyMode('b1', 'activate', challenge);

  expect(res).toEqual({ Success: false, Message: 'CHALLENGE_FAILED' });
});
