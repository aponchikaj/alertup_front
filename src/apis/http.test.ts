import { ApiError, get, type Envelope } from './http';

/**
 * FX-067: the backend answers every route with
 * { success, message, data?, ...extra }, and the client passes that envelope
 * through untouched — no capitalised mirror keys, no `id` -> `_id` copies.
 */

const reply = (status: number, body: unknown) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);

const fetchMock = jest.fn();
beforeAll(() => {
  (globalThis as { fetch: unknown }).fetch = fetchMock;
});
beforeEach(() => fetchMock.mockReset());

test('the envelope passes through as sent, extra top-level fields included', async () => {
  const body = {
    success: true,
    message: 'OK',
    data: { id: 'b1', name: 'Mall', floors: [{ id: 'f1' }] },
    Owner: { displayName: 'Nino' },
  };
  fetchMock.mockReturnValue(reply(200, body));

  const res = await get<Envelope<{ id: string; name: string }> & { Owner: { displayName: string } }>(
    '/api/building/id/b1',
  );

  expect(res).toEqual(body);
});

test('no legacy mirror keys are added', async () => {
  fetchMock.mockReturnValue(reply(200, { success: true, message: 'OK', data: { id: 'b1', nested: [{ id: 'n1' }] } }));

  const res = await get<Record<string, unknown>>('/x');

  expect(res).not.toHaveProperty('Success');
  expect(res).not.toHaveProperty('Message');
  expect(res.data).not.toHaveProperty('_id');
  expect((res.data as { nested: object[] }).nested[0]).not.toHaveProperty('_id');
});

test('a 200 failure still resolves, with the reason in message', async () => {
  fetchMock.mockReturnValue(reply(200, { success: false, message: 'Emergency mode is off.' }));
  const res = await get<Envelope>('/x');
  expect(res).toEqual({ success: false, message: 'Emergency mode is off.' });
});

test('a non-2xx failure rejects with the server message', async () => {
  fetchMock.mockReturnValue(reply(409, { success: false, message: 'No active emergency to clear.' }));
  await expect(get('/x')).rejects.toEqual(
    expect.objectContaining({ status: 409, message: 'No active emergency to clear.' }),
  );
  await expect(get('/x')).rejects.toBeInstanceOf(ApiError);
});

test('the rate-limiter body gives a readable 429 message', async () => {
  fetchMock.mockReturnValue(reply(429, { success: false, message: 'Too many attempts, try again later.' }));
  await expect(get('/x')).rejects.toEqual(
    expect.objectContaining({ status: 429, message: 'Too many attempts, try again later.' }),
  );
});

test('a rejection keeps the parsed body on the error', async () => {
  const body = { success: false, message: 'Already sent.' };
  fetchMock.mockReturnValue(reply(409, body));
  await expect(get('/x')).rejects.toEqual(expect.objectContaining({ data: body }));
});
