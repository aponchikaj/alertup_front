import { API_BASE_URL, post, put } from './http';

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
  Data?: {
    floorNumber: number;
    mapUrl: string;
    width: number;
    height: number;
  };
}

/**
 * Upload SVG file for building floor map.
 * FormData is passed straight through so the browser sets the multipart
 * boundary itself.
 */
export const uploadSVG = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('svg', file);
  return post<UploadResponse>('/api/upload/svg', formData);
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
  return put<FloorMapUpdateResponse>(`/api/building/${buildingId}/floor/${floorNumber}/map`, svgData);
};

/**
 * Convert image to SVG (basic conversion)
 */
export const convertToSVG = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('image', file);
  return post<UploadResponse>('/api/upload/convert', formData);
};

/**
 * Get uploaded SVG file URL
 */
export const getSVGUrl = (filename: string): string => {
  // Absolute: this is used as an image source, so it must point at the backend
  // origin rather than the frontend's.
  return `${API_BASE_URL}/api/upload/svg/${encodeURIComponent(filename)}`;
};
