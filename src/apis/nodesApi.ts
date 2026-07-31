import { get, post, put, del } from './http';

export interface Node {
  _id: string;
  buildingId: string;
  floorNumber: number;
  x: number;
  y: number;
  type: 'path' | 'exit' | 'stairs';
  connections: string[];
  label?: string;
  scanCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNodeRequest {
  buildingId: string;
  floorNumber: number;
  x: number;
  y: number;
  type: 'path' | 'exit' | 'stairs';
  label?: string;
  connections?: string[];
}

/** Matches what connectNodes actually sends and what the backend expects. */
export interface ConnectNodesRequest {
  buildingId: string;
  node1Id: string;
  node2Id: string;
}

/**
 * Create a new node
 */
export const createNode = async (nodeData: CreateNodeRequest) => {
  return post<{ success: boolean; node: Node; message: string }>('/api/nodes', nodeData);
};

/**
 * Get all nodes for a building
 */
export const getNodesByBuilding = async (buildingId: string) => {
  return get<{ success: boolean; nodes: Node[] }>(`/api/nodes/building/${buildingId}`);
};

/**
 * Update a node
 */
export const updateNode = async (nodeId: string, nodeData: Partial<CreateNodeRequest>) => {
  return put<{ success: boolean; node: Node; message: string }>(`/api/nodes/${nodeId}`, nodeData);
};

/**
 * Delete a node
 */
export const deleteNode = async (nodeId: string) => {
  return del<{ success: boolean; message: string }>(`/api/nodes/${nodeId}`);
};

/**
 * Connect two nodes
 */
export const connectNodes = async (buildingId: string, node1Id: string, node2Id: string) => {
  return post<{ success: boolean; message: string; data?: unknown }>('/api/nodes/connect', {
    buildingId,
    node1Id,
    node2Id,
  });
};

/**
 * Build the URL a printed QR code points at.
 *
 * Single source of truth, shared with the QR display components. This used to
 * emit `/route/qr_...` here while simpleQRCodeDisplay emitted `/scan/route/qr_...`,
 * so QR codes generated through this helper landed on a page that 404'd.
 */
export const buildScanUrl = (buildingId: string, floorNumber: number, nodeId: string, origin?: string): string => {
  const base = origin || window.location.origin;
  return `${base}/scan/route/qr_${buildingId}_${floorNumber}_${nodeId}`;
};

/** @deprecated Use buildScanUrl — kept so existing call sites keep compiling. */
export const generateNodeQRData = buildScanUrl;
