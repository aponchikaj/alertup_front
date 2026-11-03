import { streamAgent } from "./agentApi";
import type { AgentAction } from "./agentApi";

/* ============================================================================
   The agent SSE frame contract.

   This parser is a superset of aiApi's: {delta} / {done} / {fallback} still
   mean what they always meant, and {tool} / {action} are new. The tests worth
   having are the ones about FRAME BOUNDARIES — a stream arrives in arbitrary
   chunks, and a frame split across two reads must not be dropped or doubled.
   ========================================================================= */

/** Feed a canned SSE body through the parser, chunked exactly as given. */
const streamOf = (chunks: string[]) => {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () =>
          i < chunks.length
            ? { value: encoder.encode(chunks[i++]), done: false }
            : { value: undefined, done: true },
      }),
    },
  };
};

const collect = (chunks: string[]) =>
  new Promise<{
    text: string;
    tools: { name: string; ok: boolean }[];
    actions: AgentAction[];
    fallback: boolean;
    error: unknown;
  }>((resolve) => {
    const seen = {
      text: "",
      tools: [] as { name: string; ok: boolean }[],
      actions: [] as AgentAction[],
      fallback: false,
      error: null as unknown,
    };
    global.fetch = jest.fn().mockResolvedValue(streamOf(chunks)) as unknown as typeof fetch;

    streamAgent(
      "auditor",
      { messages: [{ role: "user", content: "hi" }], buildingId: "b1", locale: "en" },
      {
        onDelta: (text, meta) => {
          seen.text += text;
          if (meta.fallback) seen.fallback = true;
        },
        onTool: (tool) => seen.tools.push(tool),
        onAction: (action) => seen.actions.push(action),
        onDone: () => resolve(seen),
        onError: (error) => {
          seen.error = error;
          resolve(seen);
        },
      }
    );
  });

const frame = (payload: object) => `data: ${JSON.stringify(payload)}\n\n`;

describe("frame parsing", () => {
  test("assembles deltas in order", async () => {
    const seen = await collect([
      frame({ delta: "Your building " }),
      frame({ delta: "has no exit." }),
      frame({ done: true }),
    ]);

    expect(seen.text).toBe("Your building has no exit.");
  });

  test("reports tool frames", async () => {
    const seen = await collect([
      frame({ tool: { name: "validate_building", ok: true } }),
      frame({ delta: "Checked." }),
      frame({ done: true }),
    ]);

    expect(seen.tools).toEqual([{ name: "validate_building", ok: true }]);
  });

  test("reports action frames with their arguments", async () => {
    const seen = await collect([
      frame({ action: { name: "auto_connect_floor", args: { floorId: "f1" } } }),
      frame({ done: true }),
    ]);

    expect(seen.actions).toEqual([{ name: "auto_connect_floor", args: { floorId: "f1" } }]);
  });

  test("marks a fallback answer", async () => {
    const seen = await collect([
      frame({ delta: "Unavailable.", fallback: true }),
      frame({ done: true }),
    ]);

    expect(seen.fallback).toBe(true);
  });

  test("a frame split across two reads is delivered exactly once", async () => {
    const whole = frame({ delta: "split across reads" });
    const seen = await collect([whole.slice(0, 12), whole.slice(12), frame({ done: true })]);

    expect(seen.text).toBe("split across reads");
  });

  test("two frames arriving in one read are both delivered", async () => {
    const seen = await collect([
      frame({ delta: "a" }) + frame({ delta: "b" }),
      frame({ done: true }),
    ]);

    expect(seen.text).toBe("ab");
  });

  test("a trailing frame with no terminator is not dropped", async () => {
    // The last chunk carries a DELTA and no blank-line terminator, so it can
    // only arrive via the final buffer flush. Asserting on `done` here would
    // pass even without that flush, since onDone fires either way.
    const seen = await collect([frame({ delta: "head" }), 'data: {"delta":"tail"}']);

    expect(seen.text).toBe("headtail");
  });

  test("completes even when the server never sends done", async () => {
    const seen = await collect([frame({ delta: "truncated" })]);

    expect(seen.text).toBe("truncated");
  });

  test("a non-JSON payload is treated as plain text, not an error", async () => {
    const seen = await collect(["data: plain words\n\n", frame({ done: true })]);

    expect(seen.text).toBe("plain words");
    expect(seen.error).toBeNull();
  });
});

describe("failures", () => {
  test("surfaces a server error with its message", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ message: "Daily limit reached." }),
    }) as unknown as typeof fetch;

    const error = await new Promise<Error>((resolve) => {
      streamAgent(
        "auditor",
        { messages: [{ role: "user", content: "hi" }], buildingId: "b1", locale: "en" },
        {
          onDelta: () => {},
          onTool: () => {},
          onAction: () => {},
          onDone: () => {},
          onError: (e) => resolve(e as Error),
        }
      );
    });

    expect(error.message).toBe("Daily limit reached.");
  });

  test("an abort completes quietly rather than erroring", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" })) as unknown as typeof fetch;

    const result = await new Promise<string>((resolve) => {
      streamAgent(
        "auditor",
        { messages: [{ role: "user", content: "hi" }], buildingId: "b1", locale: "en" },
        {
          onDelta: () => {},
          onTool: () => {},
          onAction: () => {},
          onDone: () => resolve("done"),
          onError: () => resolve("error"),
        }
      );
    });

    expect(result).toBe("done");
  });
});

describe("authentication", () => {
  test("sends the Bearer token as well as the cookie", async () => {
    localStorage.setItem("userToken", "token-abc");
    const fetchMock = jest.fn().mockResolvedValue(streamOf([frame({ done: true })]));
    global.fetch = fetchMock as unknown as typeof fetch;

    await new Promise<void>((resolve) => {
      streamAgent(
        "auditor",
        { messages: [{ role: "user", content: "hi" }], buildingId: "b1", locale: "en" },
        {
          onDelta: () => {},
          onTool: () => {},
          onAction: () => {},
          onDone: () => resolve(),
          onError: () => resolve(),
        }
      );
    });

    const init = fetchMock.mock.calls[0][1];
    expect(init.headers["Authorization"]).toBe("Bearer token-abc");
    expect(init.credentials).toBe("include");
    localStorage.removeItem("userToken");
  });
});
