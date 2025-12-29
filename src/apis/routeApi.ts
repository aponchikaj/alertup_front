import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://alertup-backend.onrender.com';

export interface RoutePoint {
  x: number;
  y: number;
  type: string;
  label?: string;
  floor?: number;
}

export interface RouteResponse {
  success: boolean;
  floor: number;
  building: string;
  svgMapUrl?: string;
  svgContent?: string;
  svgDimensions: {
    width: number;
    height: number;
  };
  route: RoutePoint[];
  startPoint: {
    x: number;
    y: number;
  };
  message?: string;
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
 * Get route data by QR code ID
 * @param qrId - QR code identifier
 * @returns Promise<RouteResponse> - Route data
 */
export const getRouteByQR = async (qrId: string): Promise<RouteResponse> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/route/${qrId}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching route:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch route');
  }
};

/**
 * Get floor map data for a specific building and floor
 * @param buildingId - Building ID
 * @param floorNumber - Floor number
 * @returns Promise<FloorResponse> - Floor map data
 */
export const getFloorMap = async (buildingId: string, floorNumber: number): Promise<FloorResponse> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/route/building/${buildingId}/floor/${floorNumber}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching floor map:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch floor map');
  }
};

/**
 * Generate QR code data for emergency routing
 * @param buildingId - Building ID
 * @param floorNumber - Floor number
 * @param nodeId - Node ID for this QR location
 * @returns string - QR code data string
 */
export const generateQRData = (buildingId: string, floorNumber: number, nodeId: string): string => {
  return `${window.location.origin}/scan/route/qr_${buildingId}_${floorNumber}_${nodeId}`;
};

/**
 * Parse QR code data to extract routing information
 * @param qrData - Raw QR code data
 * @returns Object | null - Parsed QR information or null if invalid
 */
export const parseQRData = (qrData: string): {
  buildingId?: string;
  floorNumber?: number;
  nodeId?: string;
  type: 'route' | 'building' | 'unknown';
} | null => {
  try {
    // Check if it's a route QR code
    if (qrData.includes('/scan/route/qr_')) {
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
    
    // Check if it's a building QR code
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
    
    // Check for other AlertUp QR patterns
    if (qrData.includes('alertup')) {
      return { type: 'building' }; // Default to building type for other AlertUp QRs
    }
    
    return { type: 'unknown' };
  } catch (error) {
    console.error('Error parsing QR data:', error);
    return { type: 'unknown' };
  }
};

/**
 * Calculate route distance in meters (approximate)
 * @param route - Array of route points
 * @returns number - Total distance in meters
 */
export const calculateRouteDistance = (route: RoutePoint[]): number => {
  if (!route || route.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 1; i < route.length; i++) {
    const dx = route[i].x - route[i - 1].x;
    const dy = route[i].y - route[i - 1].y;
    totalDistance += Math.sqrt(dx * dx + dy * dy);
  }
  
  // Convert pixels to meters (assuming 1 pixel = 0.1 meters, adjust as needed)
  return totalDistance * 0.1;
};

/**
 * Get estimated evacuation time based on route distance
 * @param distance - Distance in meters
 * @returns number - Estimated time in seconds
 */
export const getEvacuationTime = (distance: number): number => {
  // Average walking speed during emergency: 1.2 m/s
  const averageSpeed = 1.2;
  return Math.ceil(distance / averageSpeed);
};
