import { get } from './http';

export interface RoutePoint {
  x: number;
  y: number;
  type: string;
  label?: string;
  floor?: number;
}

export interface FloorResponse {
  success: boolean;
  floor: number;
  svgMapUrl?: string;
  svgContent?: string;
  svgDimensions: {
    width: number;
    height: number;
  };
  message?: string;
}

/**
 * Get floor map data for a specific building and floor.
 *
 * Used by the node manager to render the floor plan behind the node editor.
 */
export const getFloorMap = async (buildingId: string, floorNumber: number): Promise<FloorResponse> => {
  return get<FloorResponse>(`/api/route/building/${buildingId}/floor/${floorNumber}`);
};

/**
 * Parse QR code data to extract routing information
 */
export const parseQRData = (qrData: string): {
  buildingId?: string;
  floorNumber?: number;
  nodeId?: string;
  type: 'route' | 'building' | 'unknown';
} | null => {
  try {
    // Route QR codes, in either the current `/scan/route/` form or the older
    // `/route/` form that some printed codes still use.
    if (qrData.includes('/scan/route/qr_') || qrData.includes('/route/qr_')) {
      const match = qrData.match(/qr_([^_]+)_([^_]+)_([^_]+)/);
      if (match) {
        return {
          buildingId: match[1],
          floorNumber: parseInt(match[2], 10),
          nodeId: match[3],
          type: 'route',
        };
      }
    }

    if (qrData.includes('/building/')) {
      const url = new URL(qrData);
      const pathParts = url.pathname.split('/');
      const buildingIndex = pathParts.indexOf('building');

      if (buildingIndex !== -1 && pathParts[buildingIndex + 1]) {
        return {
          buildingId: pathParts[buildingIndex + 1],
          type: 'building',
        };
      }
    }

    if (qrData.includes('alertup')) {
      return { type: 'building' };
    }

    return { type: 'unknown' };
  } catch (error) {
    console.error('Error parsing QR data:', error);
    return { type: 'unknown' };
  }
};

/**
 * Calculate route distance in meters (approximate)
 */
export const calculateRouteDistance = (route: RoutePoint[]): number => {
  if (!route || route.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < route.length; i++) {
    const dx = route[i].x - route[i - 1].x;
    const dy = route[i].y - route[i - 1].y;
    totalDistance += Math.sqrt(dx * dx + dy * dy);
  }

  // Convert pixels to meters (assuming 1 pixel = 0.1 meters)
  return totalDistance * 0.1;
};

/**
 * Get estimated evacuation time based on route distance
 */
export const getEvacuationTime = (distance: number): number => {
  // Average walking speed during emergency: 1.2 m/s
  const averageSpeed = 1.2;
  return Math.ceil(distance / averageSpeed);
};
