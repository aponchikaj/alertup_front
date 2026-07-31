import { getAuthState } from "./me";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Regression cover for "I press log in and the site just refreshes".
 *
 * The session was valid and the cookie was set, but `getAuthState` required
 * `user._id` — MongoDB's field name. After the move to PostgreSQL the API
 * returns `id`, so a signed-in user was reported as unauthenticated, the guard
 * on /dashboard bounced them to /login, and the whole thing looked like the
 * page reloading on submit.
 */

const originalFetch = global.fetch;

/** Mimics the API: a 200 whose JSON body is exactly what the server sends. */
const respondWith = (status: number, body: unknown) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as typeof fetch;
};

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe("getAuthState", () => {
  test("accepts the PostgreSQL shape: data.id, no _id anywhere", async () => {
    respondWith(200, {
      success: true,
      message: "OK",
      data: {
        id: "cms8uvnod0000hogkb8bzij3e",
        email: "lazaremirziashvili8@gmail.com",
        name: "Lazare",
        verified: false,
      },
    });

    const state = await getAuthState();

    expect(state.state).toBe("authenticated");
    if (state.state === "authenticated") {
      expect(state.user.email).toBe("lazaremirziashvili8@gmail.com");
      // The shim mirrors id -> _id so the ~40 legacy readers keep working.
      expect(state.user._id).toBe("cms8uvnod0000hogkb8bzij3e");
    }
  });

  test("still accepts a legacy Mongo response", async () => {
    respondWith(200, {
      Success: true,
      Message: { _id: "64a1b2c3d4e5f6a7b8c9d0e1", email: "old@example.com" },
    });

    const state = await getAuthState();
    expect(state.state).toBe("authenticated");
  });

  test("a 401 is a definitive logged-out, not an error", async () => {
    respondWith(401, { success: false, message: "no user token." });

    const state = await getAuthState();
    expect(state.state).toBe("unauthenticated");
  });

  test("an unreachable server is an error, never a silent logout", async () => {
    // Signing someone out because the network blipped is how you get a
    // /login <-> /dashboard bounce loop.
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const state = await getAuthState();
    expect(state.state).toBe("error");
  });

  test("a body with no user at all is unauthenticated", async () => {
    respondWith(200, { success: true, message: "OK" });

    const state = await getAuthState();
    expect(state.state).toBe("unauthenticated");
  });
});
