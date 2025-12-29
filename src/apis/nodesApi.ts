import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Node {
  _id: string;
  buildingId: string;
  floorNumber: number;
  x: number;
  y: number;
  type: 'path' | 'exit' | 'stairs';
  connections: string[];
  label?: string;
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

export interface ConnectNodesRequest {
  fromNodeId: string;
  toNodeId: string;
}

/**
 * Create a new node
 */
export const createNode = async (nodeData: CreateNodeRequest): Promise<{ success: boolean; node: Node; message: string }> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/nodes`, nodeData, { withCredentials: true });
    return response.data;
  } catch (error: any) {
    console.error('Error creating node:', error);
    throw new Error(error.response?.data?.message || 'Failed to create node');
  }
};

/**
 * Get all nodes for a building
 */
export const getNodesByBuilding = async (buildingId: string): Promise<{ success: boolean; nodes: Node[] }> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/nodes/building/${buildingId}`, { withCredentials: true });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching nodes:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch nodes');
  }
};

/**
 * Update a node
 */
export const updateNode = async (nodeId: string, nodeData: Partial<CreateNodeRequest>): Promise<{ success: boolean; node: Node; message: string }> => {
  try {
    const response = await axios.put(`${API_BASE_URL}/api/nodes/${nodeId}`, nodeData, { withCredentials: true });
    return response.data;
  } catch (error: any) {
    console.error('Error updating node:', error);
    throw new Error(error.response?.data?.message || 'Failed to update node');
  }
};

/**
 * Delete a node
 */
export const deleteNode = async (nodeId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/api/nodes/${nodeId}`, { withCredentials: true });
    return response.data;
  } catch (error: any) {
    console.error('Error deleting node:', error);
    throw new Error(error.response?.data?.message || 'Failed to delete node');
  }
};

/**
 * Connect two nodes
 */
export const connectNodes = async (buildingId: string, node1Id: string, node2Id: string): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/nodes/connect`, {
      buildingId,
      node1Id,
      node2Id
    }, { withCredentials: true });
    return response.data;
  } catch (error: any) {
    console.error('Error connecting nodes:', error);
    throw new Error(error.response?.data?.message || 'Failed to connect nodes');
  }
};

/**
 * Generate QR code data for a node
 */
export const generateNodeQRData = (buildingId: string, floorNumber: number, nodeId: string): string => {
  return `${window.location.origin}/route/qr_${buildingId}_${floorNumber}_${nodeId}`;
};
