import { post } from "./http";

/**
 * The evacuation brief: one grounded sentence naming the nearest exit.
 *
 * The server computes the route with Dijkstra FIRST and only then asks a model
 * to phrase the finished facts, so the sentence cannot name an exit the red
 * route does not lead to. When no provider answers, the server renders the
 * identical facts from a template and sets `fallback`.
 *
 * Everything here is best-effort by design: the overlay's route, buttons and
 * instructions stand on their own, and a failed brief must never delay them.
 */

export interface EvacuationBrief {
  found: boolean;
  text: string;
  exitName?: string | null;
  exitFloorNumber?: number | null;
  distanceMeters?: number;
  floorChanges?: number;
  /** True when the computed route runs through a lift — routing permits it. */
  usesElevator?: boolean;
  accessibleRouteUnavailable?: boolean;
  /** True when the deterministic template answered instead of a model. */
  fallback?: boolean;
}

export async function fetchEvacuationBrief(params: {
  buildingId: string;
  nodeId: string;
  locale: "en" | "ka";
  accessible?: boolean;
  signal?: AbortSignal;
}): Promise<EvacuationBrief | null> {
  const { signal, ...body } = params;
  try {
    const res = await post<{ success: boolean; data: EvacuationBrief }>(
      "/api/ai/evacuation-brief",
      body,
      { signal }
    );
    return res?.data ?? null;
  } catch {
    // Swallowed on purpose. The overlay is the alert; a missing extra sentence
    // is not worth an error state in front of someone who needs to leave.
    return null;
  }
}
