import { act, renderHook, waitFor } from "@testing-library/react";
import { useAgentChat } from "./useAgentChat";
import { streamAgent } from "../../apis/agentApi";

jest.mock("../../apis/agentApi", () => ({ streamAgent: jest.fn() }));

const mockedStreamAgent = streamAgent as jest.MockedFunction<typeof streamAgent>;

/* ============================================================================
   The shared agent conversation state machine.

   Two behaviours here are not obvious and are worth pinning down:

   1. An assistant turn that produces no text is REMOVED, so a failed request
      does not leave an empty bubble in the transcript.
   2. Actions are collected during the stream and attached to the assistant
      turn only when it finishes — a button must not appear next to a sentence
      that is still being written.
   ========================================================================= */

/** Drive the callbacks the way a real stream would. */
const respond = (script: (cb: Parameters<typeof streamAgent>[2]) => void) => {
  mockedStreamAgent.mockImplementation((_agentId, _body, callbacks) => {
    script(callbacks);
  });
};

const options = { buildingId: "b1", locale: "en" as const };

beforeEach(() => jest.clearAllMocks());

describe("sending a turn", () => {
  test("records the question and the streamed answer", async () => {
    respond((cb) => {
      cb.onDelta("The pharmacy ", { fallback: false });
      cb.onDelta("is on floor 2.", { fallback: false });
      cb.onDone();
    });

    const { result } = renderHook(() => useAgentChat("wayfinder", options));
    act(() => result.current.send("where is the pharmacy?"));

    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      role: "user",
      content: "where is the pharmacy?",
    });
    expect(result.current.messages[1].content).toBe("The pharmacy is on floor 2.");
  });

  test("ignores an empty question", () => {
    const { result } = renderHook(() => useAgentChat("wayfinder", options));
    act(() => result.current.send("   "));

    expect(mockedStreamAgent).not.toHaveBeenCalled();
  });

  test("sends at most the last six turns", async () => {
    respond((cb) => cb.onDone());
    const { result } = renderHook(() => useAgentChat("wayfinder", options));

    for (let i = 0; i < 5; i++) {
      act(() => result.current.send(`question ${i}`));
      await waitFor(() => expect(result.current.streaming).toBe(false));
    }

    const lastBody = mockedStreamAgent.mock.calls.at(-1)?.[1];
    expect(lastBody?.messages.length).toBeLessThanOrEqual(6);
  });

  test("passes the scan position through to the agent", async () => {
    respond((cb) => cb.onDone());
    const { result } = renderHook(() =>
      useAgentChat("wayfinder", { ...options, nodeId: "n1" })
    );

    act(() => result.current.send("where is the exit?"));
    await waitFor(() => expect(result.current.streaming).toBe(false));

    expect(mockedStreamAgent.mock.calls[0][1]).toMatchObject({
      buildingId: "b1",
      nodeId: "n1",
    });
  });
});

describe("tools and actions", () => {
  test("surfaces the running tool while it works, and clears it after", async () => {
    let capture: Parameters<typeof streamAgent>[2] | null = null;
    mockedStreamAgent.mockImplementation((_a, _b, cb) => {
      capture = cb;
    });

    const { result } = renderHook(() => useAgentChat("wayfinder", options));
    act(() => result.current.send("where is the pharmacy?"));

    act(() => capture!.onTool({ name: "search_destinations", ok: true }));
    await waitFor(() => expect(result.current.activeTool).toBe("search_destinations"));

    act(() => capture!.onDone());
    await waitFor(() => expect(result.current.activeTool).toBeNull());
  });

  test("attaches actions to the assistant turn when it completes", async () => {
    respond((cb) => {
      cb.onDelta("It is on floor 2.", { fallback: false });
      cb.onAction({ name: "show_route_to", args: { poiId: "p1", name: "Pharmacy" } });
      cb.onDone();
    });

    const { result } = renderHook(() => useAgentChat("wayfinder", options));
    act(() => result.current.send("where is the pharmacy?"));

    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(result.current.messages[1].actions).toEqual([
      { name: "show_route_to", args: { poiId: "p1", name: "Pharmacy" } },
    ]);
  });

  test("hands every action to onAction as it arrives", async () => {
    const onAction = jest.fn();
    respond((cb) => {
      cb.onAction({ name: "show_route_to", args: { poiId: "p1" } });
      cb.onDone();
    });

    const { result } = renderHook(() => useAgentChat("wayfinder", { ...options, onAction }));
    act(() => result.current.send("route me"));

    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(onAction).toHaveBeenCalledWith({ name: "show_route_to", args: { poiId: "p1" } });
  });
});

describe("failure", () => {
  test("marks the conversation unavailable and drops the empty turn", async () => {
    respond((cb) => cb.onError(new Error("network")));

    const { result } = renderHook(() => useAgentChat("wayfinder", options));
    act(() => result.current.send("hello"));

    await waitFor(() => expect(result.current.unavailable).toBe(true));
    // The user's own turn stays; the empty assistant bubble does not.
    expect(result.current.messages.map((m) => m.role)).toEqual(["user"]);
  });

  test("an answer that produced no text leaves no empty bubble", async () => {
    respond((cb) => cb.onDone());

    const { result } = renderHook(() => useAgentChat("wayfinder", options));
    act(() => result.current.send("hello"));

    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(result.current.messages.map((m) => m.role)).toEqual(["user"]);
  });

  test("marks a fallback answer so the UI can flag it", async () => {
    respond((cb) => {
      cb.onDelta("Assistant unavailable.", { fallback: true });
      cb.onDone();
    });

    const { result } = renderHook(() => useAgentChat("wayfinder", options));
    act(() => result.current.send("hello"));

    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(result.current.messages[1].fallback).toBe(true);
  });

  test("reset clears the transcript and the unavailable flag", async () => {
    respond((cb) => cb.onError(new Error("network")));

    const { result } = renderHook(() => useAgentChat("wayfinder", options));
    act(() => result.current.send("hello"));
    await waitFor(() => expect(result.current.unavailable).toBe(true));

    act(() => result.current.reset());

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.unavailable).toBe(false);
  });
});
