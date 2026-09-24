import { createBuildingChannel } from "./realtime";
import type { ChannelStatus } from "../emergency/types";

/**
 * onStatusChange must replay the channel's current status to a new subscriber
 * synchronously. Without that replay every consumer has to call status()
 * itself right after subscribing — and in React that is a setState directly in
 * an effect body (react-hooks/set-state-in-effect). Making the subscription
 * self-seeding removes the need for the extra call and closes the window where
 * a status change between status() and onStatusChange() would be missed.
 */
describe("createBuildingChannel().onStatusChange", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: null }),
    }) as unknown as typeof fetch;
  });

  it("invokes the callback immediately with the current status", () => {
    const channel = createBuildingChannel(`b-${Math.random()}`);
    const seen: ChannelStatus[] = [];

    const unsubscribe = channel.onStatusChange((s) => seen.push(s));

    expect(seen).toEqual([channel.status()]);

    unsubscribe();
    channel.close();
  });

  it("stops replaying and stops delivering once unsubscribed", () => {
    const channel = createBuildingChannel(`b-${Math.random()}`);
    const seen: ChannelStatus[] = [];

    const unsubscribe = channel.onStatusChange((s) => seen.push(s));
    expect(seen).toHaveLength(1);

    unsubscribe();
    channel.close();
    expect(seen).toHaveLength(1);
  });
});
