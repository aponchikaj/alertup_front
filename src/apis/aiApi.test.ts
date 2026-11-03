import { streamChat } from './aiApi';

/* FX-059 — Safari/iOS drops the cross-site session cookie, so every API call
   also carries the session as a Bearer token (http.ts does this for normal
   requests). The concierge stream used a raw fetch without it, so a signed-in
   Safari user was anonymous to the assistant. */

const okStream = () =>
  ({
    ok: true,
    body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) },
  }) as unknown as Response;

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue(okStream()) as unknown as typeof fetch;
});

const flush = () => new Promise((r) => setTimeout(r, 0));

test('sends the stored session token as a Bearer header', async () => {
  localStorage.setItem('userToken', 'tok123');

  streamChat([], { buildingId: 'b1', locale: 'en' }, { onDelta: jest.fn(), onDone: jest.fn(), onError: jest.fn() });
  await flush();

  const [, init] = (global.fetch as jest.Mock).mock.calls[0];
  expect(init.headers.Authorization).toBe('Bearer tok123');
});

test('sends no Authorization header when signed out', async () => {
  streamChat([], { buildingId: 'b1', locale: 'en' }, { onDelta: jest.fn(), onDone: jest.fn(), onError: jest.fn() });
  await flush();

  const [, init] = (global.fetch as jest.Mock).mock.calls[0];
  expect(init.headers.Authorization).toBeUndefined();
});
