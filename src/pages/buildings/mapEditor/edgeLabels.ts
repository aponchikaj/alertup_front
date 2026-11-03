/* ============================================================================
   How one end of a connection is named for a human.
   ----------------------------------------------------------------------------
   Extracted so the edge inspector's direction options and the closures panel's
   keyboard picker cannot drift apart: an operator who reads "Lobby to
   Corridor" in the direction Select and "Entrance to Corridor" in the closure
   list has no way to tell whether they are looking at the same connection.

   The fallback ladder is deliberate: an authored label first, the node type as
   a category when there is none, and finally a short id — short, because the
   point of the last rung is to disambiguate two otherwise identical rows, not
   to be read aloud in full.
   ========================================================================= */

/** Anything with the two naming fields — MapNode and EditorNode both fit. */
export interface LabelledNode {
  label?: string | null;
  type?: string | null;
}

export const endpointLabel = (
  node: LabelledNode | null | undefined,
  fallbackId: string,
): string => node?.label || node?.type || fallbackId.slice(0, 8);

export default endpointLabel;
