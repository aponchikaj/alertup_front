import type { Node as LegacyNode } from '../../../apis/nodesApi';
import type { NodeType } from '../../../components/map';
import type { EditorNode } from '../../../apis/mapEditorApi';

/** The legacy QR component predates the graph model; map onto its node shape. */
const LEGACY_TYPES: Record<NodeType, LegacyNode['type']> = {
  NORMAL: 'path',
  ENTRANCE: 'path',
  POI: 'path',
  TRANSIT: 'stairs',
  EMERGENCY_EXIT: 'exit',
};

export const byFloorNumber = <T extends { floorNumber: number }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => a.floorNumber - b.floorNumber);

/** Closest node to (x, y) on a floor, with its distance. */
export const nearestNodeOnFloor = (
  nodes: EditorNode[],
  floorId: string,
  x: number,
  y: number,
): { node: EditorNode; distance: number } | null => {
  let best: { node: EditorNode; distance: number } | null = null;
  for (const node of nodes) {
    if (node.floorId !== floorId) continue;
    const distance = Math.hypot(node.x - x, node.y - y);
    if (!best || distance < best.distance) best = { node, distance };
  }
  return best;
};

export const toLegacyNode = (node: EditorNode, floorNumber: number): LegacyNode => ({
  id: node.id,
  buildingId: node.buildingId,
  floorNumber,
  x: node.x,
  y: node.y,
  type: LEGACY_TYPES[node.type],
  connections: [],
  label: node.label ?? undefined,
  scanCount: node.scanCount,
  createdAt: '',
  updatedAt: '',
});
