import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance with timeout
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

export interface RouteNode {
  x: number;
  y: number;
  type: 'path' | 'exit' | 'stairs';
  label?: string;
}

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
 * Fetch emergency route for a given QR code
 * @param qrId - The scanned QR code identifier
 * @returns Route data with SVG map and coordinates
 * @throws {Error} If request fails or QR code is invalid
 */
export const getRoute = async (qrId: string | null | undefined): Promise<RouteResponse> => {
  // Validate input
  if (!qrId || typeof qrId !== 'string' || qrId.length === 0) {
    throw new Error('Invalid QR code format');
  }

  if (qrId.length > 500) {
    throw new Error('QR code is too long');
  }

  try {
    const response = await axiosInstance.get<RouteResponse>(
      `/route/${encodeURIComponent(qrId)}`
    );

    // Validate response structure
    if (!response.data) {
      throw new Error('Empty response from server');
    }

    if (typeof response.data.success !== 'boolean') {
      throw new Error('Invalid response format');
    }

    if (!response.data.success) {
      throw new Error('Failed to get route');
    }

    // Validate required fields
    if (!Array.isArray(response.data.route)) {
      throw new Error('Route is not an array');
    }

    if (!response.data.svgDimensions || typeof response.data.svgDimensions !== 'object') {
      throw new Error('SVG dimensions are invalid');
    }

    if (!response.data.startPoint || typeof response.data.startPoint !== 'object') {
      throw new Error('Start point is invalid');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error('QR code not found or is inactive');
      }
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.message || 'Invalid QR code');
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout - server not responding');
      }
      if (!error.response) {
        throw new Error('Network error - unable to connect to server');
      }
      throw new Error(
        error.response?.data?.message || 'Failed to fetch route data'
      );
    }
    throw error;
  }
};

/**
 * Fetch floor map data without route
 * @param buildingId - Building identifier
 * @param floorNumber - Floor number
 * @returns Floor data with SVG information
 * @throws {Error} If floor not found or request fails
 */
export const getFloorMap = async (
  buildingId: string | null | undefined,
  floorNumber: number | null | undefined
): Promise<Omit<RouteResponse, 'route' | 'startPoint'>> => {
  // Validate inputs
  if (!buildingId || typeof buildingId !== 'string' || buildingId.length === 0) {
    throw new Error('Invalid building ID');
  }

  if (typeof floorNumber !== 'number' || floorNumber < 0 || isNaN(floorNumber)) {
    throw new Error('Invalid floor number');
  }

  try {
    const response = await axiosInstance.get<Omit<RouteResponse, 'route' | 'startPoint'>>(
      `/route/building/${encodeURIComponent(buildingId)}/floor/${floorNumber}`
    );

    if (!response.data) {
      throw new Error('Empty response from server');
    }

    if (!response.data.success) {
      throw new Error('Failed to get floor map');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        throw new Error('Floor not found');
      }
      if (error.response?.status === 400) {
        throw new Error(error.response.data?.message || 'Invalid parameters');
      }
      throw new Error(
        error.response?.data?.message || 'Failed to fetch floor data'
      );
    }
    throw error;
  }
};
