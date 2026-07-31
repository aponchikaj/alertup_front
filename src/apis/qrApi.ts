import { post, del, getBlob } from './http';

export interface QRCodeRequest {
  nodeId?: string;
  buildingId?: string;
  floorNumber?: number;
  format?: 'png' | 'svg';
  customization?: {
    primaryColor?: string;
    backgroundColor?: string;
    title?: string;
    titleColor?: string;
    subtitle?: string;
    subtitleColor?: string;
    logo?: string;
    size?: 'small' | 'medium' | 'large';
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
  };
}

/**
 * Generate QR code for a node
 */
export const generateQRCode = async (request: QRCodeRequest): Promise<QRCodeResponse> => {
  return post<QRCodeResponse>('/api/qr/generate', request);
};

/**
 * Download QR code file
 */
export const downloadQRCode = async (filename: string): Promise<Blob> => {
  return getBlob(`/api/qr/download/${encodeURIComponent(filename)}`);
};

/**
 * Delete QR code file
 */
export const deleteQRCode = async (buildingId: string, qrUrl: string) => {
  // buildingId is part of the path so the server can authorize the caller and
  // confirm the asset belongs to that building.
  return del<{ success: boolean; message: string }>(
    `/api/qr/${encodeURIComponent(buildingId)}/${encodeURIComponent(qrUrl)}`,
  );
};

// getQRCodeUrl and getQRCodePublicUrl were removed. QR images live on
// Cloudinary and are referenced by their secure_url; nothing is written to the
// API server's uploads/qr-codes directory, so both helpers produced URLs that
// could only 404.

/**
 * Download QR code as file
 */
export const downloadQRCodeAsFile = async (filename: string, nodeName: string): Promise<void> => {
  const blob = await downloadQRCode(filename);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `qr-code-${nodeName.replace(/\s+/g, '-').toLowerCase()}-${filename}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
