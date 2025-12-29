/**
 * Emergency Exit Routing System - Type Definitions
 */

export type NodeType = 'path' | 'exit' | 'stairs';

/**
 * Represents a single node in the indoor map
 */
export interface MapNode {
  _id: string;
  buildingId: string;
  floorNumber: number;
  x: number;
  y: number;
  type: NodeType;
  connections: string[];
  label?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Represents a single point in a route
 */
export interface RouteNode {
  x: number;
  y: number;
  type: NodeType;
  label?: string;
}

/**
 * Represents a floor in a building
 */
export interface Floor {
  _id: string;
  buildingId: string;
  floorNumber: number;
  svgMapUrl: string;
  svgContent?: string;
  width?: number;
  height?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Represents a QR code linked to a location
 */
export interface QRCodeRecord {
  _id: string;
  code: string;
  buildingId: string;
  floorNumber: number;
  nodeId: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Response structure for route API
 */
export interface RouteResponse {
  success: boolean;
  floor: number;
  building?: string;
  svgMapUrl?: string;
  svgContent?: string;
  svgDimensions: {
    width: number;
    height: number;
  };
  route: RouteNode[];
  startPoint: {
    x: number;
    y: number;
  };
}

/**
 * Request parameters for route calculation
 */
export interface RouteRequest {
  qrId: string;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
}

/**
 * BFS Queue item for route calculation
 */
export interface BFSQueueItem {
  nodeId: string;
  path: MapNode[];
}

/**
 * Configuration for SVG rendering
 */
export interface SVGConfig {
  viewBox: string;
  width: number;
  height: number;
  preserveAspectRatio: string;
}

/**
 * Route calculation options
 */
export interface RouteOptions {
  avoidStairs?: boolean;
  maxDistance?: number;
  includeAlternates?: boolean;
}
