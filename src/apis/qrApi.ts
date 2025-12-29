import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://alertup-backend.onrender.com';

export interface QRCodeRequest {
  nodeId?: string;
  buildingId?: string;
  floorNumber?: number;
  format?: 'png' | 'svg';
  customization?: {
    primaryColor?: string;      // Main QR code color
    backgroundColor?: string;    // Background color
    title?: string;             // Title text
    titleColor?: string;        // Title color
    subtitle?: string;          // Subtitle text (building/floor info)
    subtitleColor?: string;     // Subtitle color
    logo?: string;              // Logo URL (optional)
    size?: 'small' | 'medium' | 'large'; // QR code size
  };
}

export interface QRCodeResponse {
  success: boolean;
  message: string;
  data?: {
    qrData: string;
    format: string;
    filename?: string;
    url?: string;
    svgContent?: string;
    dimensions?: { width: number; height: number };
    size?: number;
    customization?: {
      primaryColor: string;
      backgroundColor: string;
      title: string;
      titleColor: string;
      subtitle: string;
      subtitleColor: string;
    };
  };
}

/**
 * Generate QR code for a node
 */
export const generateQRCode = async (request: QRCodeRequest): Promise<QRCodeResponse> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/qr/generate`, request, { withCredentials: true });
    return response.data;
  } catch (error: any) {
    console.error('Error generating QR code:', error);
    throw new Error(error.response?.data?.message || 'Failed to generate QR code');
  }
};

/**
 * Download QR code file
 */
export const downloadQRCode = async (filename: string): Promise<Blob> => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/qr/download/${filename}`, {
      responseType: 'blob',
      withCredentials: true
    });
    return response.data;
  } catch (error: any) {
    console.error('Error downloading QR code:', error);
    throw new Error(error.response?.data?.message || 'Failed to download QR code');
  }
};

/**
 * Delete QR code file
 */
export const deleteQRCode = async (filename: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/api/qr/${filename}`, { withCredentials: true });
    return response.data;
  } catch (error: any) {
    console.error('Error deleting QR code:', error);
    throw new Error(error.response?.data?.message || 'Failed to delete QR code');
  }
};

/**
 * Get QR code URL for display
 */
export const getQRCodeUrl = (filename: string): string => {
  return `${API_BASE_URL}/uploads/qr-codes/${filename}`;
};

/**
 * Get QR code public URL (with full domain)
 */
export const getQRCodePublicUrl = (filename: string): string => {
  return `${API_BASE_URL}/api/qr/file/${filename}`;
};

/**
 * Download QR code as file
 */
export const downloadQRCodeAsFile = async (filename: string, nodeName: string): Promise<void> => {
  try {
    const blob = await downloadQRCode(filename);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-code-${nodeName.replace(/\s+/g, '-').toLowerCase()}-${filename}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading QR code file:', error);
    throw error;
  }
};
