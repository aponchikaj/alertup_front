import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface UploadResponse {
  success: boolean;
  message: string;
  data?: {
    svgContent: string;
    svgPath: string;
    width: number;
    height: number;
    originalName: string;
    size: number;
  };
}

export interface FloorMapUpdateResponse {
  Success: boolean;
  Message: string;
  floorData?: any;
}

/**
 * Upload SVG file for building floor map
 */
export const uploadSVG = async (file: File): Promise<UploadResponse> => {
  try {
    const formData = new FormData();
    formData.append('svg', file);

    const response = await axios.post(`${API_BASE_URL}/api/upload/svg`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Error uploading SVG:', error);
    throw new Error(error.response?.data?.message || 'Failed to upload SVG');
  }
};

/**
 * Update floor map with SVG content
 */
export const updateFloorMap = async (
  buildingId: string,
  floorNumber: number,
  svgData: {
    svgContent: string;
    svgMapUrl?: string;
    width: number;
    height: number;
  }
): Promise<FloorMapUpdateResponse> => {
  try {
    const response = await axios.put(
      `${API_BASE_URL}/api/building/${buildingId}/floor/${floorNumber}/map`,
      svgData,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true,
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Error updating floor map:', error);
    throw new Error(error.response?.data?.Message || 'Failed to update floor map');
  }
};

/**
 * Convert image to SVG (basic conversion)
 */
export const convertToSVG = async (file: File): Promise<UploadResponse> => {
  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await axios.post(`${API_BASE_URL}/api/upload/convert`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Error converting to SVG:', error);
    throw new Error(error.response?.data?.message || 'Failed to convert to SVG');
  }
};

/**
 * Get uploaded SVG file URL
 */
export const getSVGUrl = (filename: string): string => {
  return `${API_BASE_URL}/api/upload/svg/${filename}`;
};
