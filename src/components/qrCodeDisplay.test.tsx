import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import QRCodeDisplay from './qrCodeDisplay';
import { type Node } from '../apis/nodesApi';
import * as qrApi from '../apis/qrApi';

// Mock the QR API
jest.mock('../apis/qrApi');
const mockGenerateQRCode = qrApi.generateQRCode as jest.MockedFunction<typeof qrApi.generateQRCode>;
const mockDownloadQRCodeAsFile = qrApi.downloadQRCodeAsFile as jest.MockedFunction<typeof qrApi.downloadQRCodeAsFile>;

// Mock data
const mockNode: Node = {
  _id: 'node1',
  buildingId: 'building1',
  floorNumber: 1,
  x: 100,
  y: 200,
  type: 'exit',
  connections: ['node2'],
  label: 'Main Exit',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

const defaultProps = {
  node: mockNode,
  onClose: jest.fn()
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('QRCodeDisplay Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders QR code modal with node information', () => {
    renderWithRouter(<QRCodeDisplay {...defaultProps} />);
    
    expect(screen.getByText('QR Code for Main Exit')).toBeInTheDocument();
    expect(screen.getByText('Type: exit')).toBeInTheDocument();
    expect(screen.getByText('Location: (100, 200)')).toBeInTheDocument();
    expect(screen.getByText('Floor: 1')).toBeInTheDocument();
  });

  it('shows format selection buttons', () => {
    renderWithRouter(<QRCodeDisplay {...defaultProps} />);
    
    expect(screen.getByText('PNG')).toBeInTheDocument();
    expect(screen.getByText('SVG')).toBeInTheDocument();
  });

  it('shows generate QR code button initially', () => {
    renderWithRouter(<QRCodeDisplay {...defaultProps} />);
    
    expect(screen.getByText('Generate QR Code')).toBeInTheDocument();
  });

  it('generates QR code when button is clicked', async () => {
    const user = userEvent.setup();
    
    mockGenerateQRCode.mockResolvedValue({
      success: true,
      message: 'QR code generated successfully',
      data: {
        qrData: 'test-qr-data',
        format: 'png',
        filename: 'test-qr.png',
        url: 'http://localhost:3001/uploads/qr-codes/test-qr.png',
        dimensions: { width: 300, height: 300 }
      }
    });

    renderWithRouter(<QRCodeDisplay {...defaultProps} />);
    
    const generateButton = screen.getByText('Generate QR Code');
    await user.click(generateButton);

    expect(mockGenerateQRCode).toHaveBeenCalledWith({
      nodeId: 'node1',
      buildingId: 'building1',
      floorNumber: 1,
      format: 'png'
    });
  });

  it('displays PNG QR code when generated', async () => {
    const user = userEvent.setup();
    
    mockGenerateQRCode.mockResolvedValue({
      success: true,
      message: 'QR code generated successfully',
      data: {
        qrData: 'test-qr-data',
        format: 'png',
        filename: 'test-qr.png',
        url: 'http://localhost:3001/uploads/qr-codes/test-qr.png',
        dimensions: { width: 300, height: 300 }
      }
    });

    renderWithRouter(<QRCodeDisplay {...defaultProps} />);
    
    const generateButton = screen.getByText('Generate QR Code');
    await user.click(generateButton);

    await waitFor(() => {
      const qrImage = screen.getByAltText('QR Code');
      expect(qrImage).toBeInTheDocument();
      expect(qrImage).toHaveAttribute('src', 'http://localhost:3001/uploads/qr-codes/test-qr.png');
    });
  });

  it('displays SVG QR code when generated', async () => {
    const user = userEvent.setup();
    
    mockGenerateQRCode.mockResolvedValue({
      success: true,
      message: 'QR code generated successfully',
      data: {
        qrData: 'test-qr-data',
        format: 'svg',
        svgContent: '<svg><rect width="300" height="300"/></svg>',
        dimensions: { width: 300, height: 300 }
      }
    });

    renderWithRouter(<QRCodeDisplay {...defaultProps} />);
    
    // Switch to SVG format
    const svgButton = screen.getByText('SVG');
    await user.click(svgButton);
    
    const generateButton = screen.getByText('Generate QR Code');
    await user.click(generateButton);

    await waitFor(() => {
      const qrContainer = document.querySelector('[data-testid="qr-svg-container"]');
      expect(qrContainer).toBeInTheDocument();
      expect(qrContainer?.innerHTML).toContain('<svg>');
    });
  });

  it('shows QR code data when generated', async () => {
    const user = userEvent.setup();
    
    mockGenerateQRCode.mockResolvedValue({
      success: true,
      message: 'QR code generated successfully',
      data: {
        qrData: 'test-qr-data',
        format: 'png',
        filename: 'test-qr.png',
        url: 'http://localhost:3001/uploads/qr-codes/test-qr.png',
        dimensions: { width: 300, height: 300 }
      }
    });

    renderWithRouter(<QRCodeDisplay {...defaultProps} />);
    
    const generateButton = screen.getByText('Generate QR Code');
    await user.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('QR Code Data:')).toBeInTheDocument();
      expect(screen.getByText('test-qr-data')).toBeInTheDocument();
    });
  });

  it('handles download button click', async () => {
    const user = userEvent.setup();
    
    mockGenerateQRCode.mockResolvedValue({
      success: true,
      message: 'QR code generated successfully',
      data: {
        qrData: 'test-qr-data',
        format: 'png',
        filename: 'test-qr.png',
        url: 'http://localhost:3001/uploads/qr-codes/test-qr.png',
        dimensions: { width: 300, height: 300 }
      }
    });

    mockDownloadQRCodeAsFile.mockResolvedValue(undefined);

    renderWithRouter(<QRCodeDisplay {...defaultProps} />);
    
    const generateButton = screen.getByText('Generate QR Code');
    await user.click(generateButton);

    await waitFor(() => {
      const downloadButton = screen.getByText('Download');
      expect(downloadButton).toBeInTheDocument();
    });

    const downloadButton = screen.getByText('Download');
    await user.click(downloadButton);

    expect(mockDownloadQRCodeAsFile).toHaveBeenCalledWith('test-qr.png', 'Main Exit');
  });

  it('handles copy link functionality', async () => {
    const user = userEvent.setup();
    
    // Mock clipboard API
    const mockWriteText = jest.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText
      }
    });

    mockGenerateQRCode.mockResolvedValue({
      success: true,
      message: 'QR code generated successfully',
      data: {
        qrData: 'test-qr-data',
        format: 'png',
        filename: 'test-qr.png',
        url: 'http://localhost:3001/uploads/qr-codes/test-qr.png',
        dimensions: { width: 300, height: 300 }
      }
    });

    renderWithRouter(<QRCodeDisplay {...defaultProps} />);
    
    const generateButton = screen.getByText('Generate QR Code');
    await user.click(generateButton);

    await waitFor(() => {
      const copyButton = screen.getByText('Copy Link');
      expect(copyButton).toBeInTheDocument();
    });

    const copyButton = screen.getByText('Copy Link');
    await user.click(copyButton);

    expect(mockWriteText).toHaveBeenCalledWith('test-qr-data');
  });

  it('shows error message when generation fails', async () => {
    const user = userEvent.setup();
    
    mockGenerateQRCode.mockRejectedValue(new Error('Generation failed'));

    renderWithRouter(<QRCodeDisplay {...defaultProps} />);
    
    const generateButton = screen.getByText('Generate QR Code');
    await user.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/Generation failed/)).toBeInTheDocument();
    });
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = jest.fn();

    renderWithRouter(<QRCodeDisplay {...defaultProps} onClose={mockOnClose} />);
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows usage instructions', () => {
    renderWithRouter(<QRCodeDisplay {...defaultProps} />);
    
    expect(screen.getByText('How to use:')).toBeInTheDocument();
    expect(screen.getByText('Print this QR code and place it at node location')).toBeInTheDocument();
    expect(screen.getByText('Users can scan it to get emergency escape routes')).toBeInTheDocument();
    expect(screen.getByText('The QR code will show the shortest path to the nearest exit')).toBeInTheDocument();
  });
});
