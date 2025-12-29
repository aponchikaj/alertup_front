import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EmergencyMap from './emergencyMap';
import * as routeService from '../apis/routeService';

// Mock the route service
jest.mock('../apis/routeService');

// Mock data
const mockRouteData = {
  success: true,
  route: [
    { x: 100, y: 100, type: 'path', label: 'Entrance' },
    { x: 250, y: 250, type: 'path', label: 'Corridor' },
    { x: 400, y: 400, type: 'stairs', label: 'Stairwell A' },
    { x: 500, y: 500, type: 'exit', label: 'Emergency Exit' },
  ],
  startPoint: { x: 100, y: 100 },
  svgDimensions: { width: 800, height: 600 },
  svgContent: '<rect width="800" height="600" fill="#f5f5f5" />',
  building: 'Building A',
  floor: 1,
};

describe('EmergencyMap Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Loading States', () => {
    test('should display "Scan QR Code" when no QR ID is provided', () => {
      render(<EmergencyMap qrId={null} />);

      expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
      expect(
        screen.getByText('Please scan a QR code to view the emergency exit route')
      ).toBeInTheDocument();
    });

    test('should display "Scan QR Code" when QR ID is empty string', () => {
      render(<EmergencyMap qrId="" />);

      expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
    });

    test('should display "Scan QR Code" when QR ID is undefined', () => {
      render(<EmergencyMap qrId={undefined} />);

      expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
    });

    test('should display loading spinner while fetching route', async () => {
      (routeService.getRoute as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockRouteData), 100);
          })
      );

      render(<EmergencyMap qrId="test-qr-id-123" />);

      expect(screen.getByText('Loading emergency exit route...')).toBeInTheDocument();

      // Wait for loading to finish
      await waitFor(
        () => {
          expect(screen.queryByText('Loading emergency exit route...')).not.toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    test('should display emergency map when QR ID is valid', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      render(<EmergencyMap qrId="test-qr-id-123" />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('Emergency Exit Route')).toBeInTheDocument();
      });

      expect(screen.getByText(/Building: Building A/)).toBeInTheDocument();
      expect(screen.getByText(/Floor: 1/)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('should display error when API call fails', async () => {
      (routeService.getRoute as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        expect(screen.getByText('Navigation Error')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    test('should display error for invalid response format', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue({
        success: false,
        route: null,
      });

      render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        expect(screen.getByText('Navigation Error')).toBeInTheDocument();
      });
    });

    test('should display error for empty route', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue({
        ...mockRouteData,
        route: [],
      });

      render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        expect(screen.getByText('Navigation Error')).toBeInTheDocument();
      });
    });

    test('should display error when node data is invalid (missing x)', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue({
        ...mockRouteData,
        route: [{ y: 100, type: 'path' }], // Missing x
      });

      render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        expect(screen.getByText('Navigation Error')).toBeInTheDocument();
      });
    });

    test('should display error when node data is invalid (missing y)', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue({
        ...mockRouteData,
        route: [{ x: 100, type: 'path' }], // Missing y
      });

      render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        expect(screen.getByText('Navigation Error')).toBeInTheDocument();
      });
    });

    test('should display error when SVG dimensions are invalid', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue({
        ...mockRouteData,
        svgDimensions: { width: 0, height: 0 },
      });

      render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        expect(screen.getByText('Navigation Error')).toBeInTheDocument();
      });
    });

    test('should display error when start point is invalid', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue({
        ...mockRouteData,
        startPoint: { x: 'invalid', y: 100 },
      });

      render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        expect(screen.getByText('Navigation Error')).toBeInTheDocument();
      });
    });
  });

  describe('Route Visualization', () => {
    test('should render SVG map with correct viewBox dimensions', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      const { container } = render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        const svg = container.querySelector('svg.floor-map');
        expect(svg).toHaveAttribute('viewBox', '0 0 800 600');
      });
    });

    test('should render SVG content from route data', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      const { container } = render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        const svgContent = container.querySelector('.svg-floor-content');
        expect(svgContent).toBeInTheDocument();
      });
    });

    test('should render polyline for route path', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      const { container } = render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        const polyline = container.querySelector('polyline.route-path');
        expect(polyline).toBeInTheDocument();
        expect(polyline).toHaveAttribute('stroke', '#ff0000');
        expect(polyline).toHaveAttribute('points');
      });
    });

    test('should render start point marker', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      const { container } = render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        const startPoint = container.querySelector('circle.start-point');
        expect(startPoint).toBeInTheDocument();
        expect(startPoint).toHaveAttribute('cx', '100');
        expect(startPoint).toHaveAttribute('cy', '100');
        expect(startPoint).toHaveAttribute('fill', '#00cc00');
      });
    });

    test('should render route nodes with correct colors', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      const { container } = render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        const exitNode = container.querySelector('circle.route-node.exit');
        const pathNode = container.querySelector('circle.route-node.path');
        const stairsNode = container.querySelector('circle.route-node.stairs');

        expect(exitNode).toHaveAttribute('fill', '#ff0000');
        expect(pathNode).toHaveAttribute('fill', '#0066ff');
        expect(stairsNode).toHaveAttribute('fill', '#ffaa00');
      });
    });

    test('should render exit pulse animation', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      const { container } = render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        const exitPulse = container.querySelector('circle.exit-pulse');
        expect(exitPulse).toBeInTheDocument();
        expect(exitPulse).toHaveAttribute('stroke', '#ff0000');
      });
    });

    test('should render legend with all node types', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        expect(screen.getByText('Your Location')).toBeInTheDocument();
        expect(screen.getByText('Exit')).toBeInTheDocument();
        expect(screen.getByText('Stairs')).toBeInTheDocument();
        expect(screen.getByText('Path')).toBeInTheDocument();
        expect(screen.getByText('Route')).toBeInTheDocument();
      });
    });

    test('should display route information', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        expect(screen.getByText('Follow the red line to the nearest exit')).toBeInTheDocument();
        expect(screen.getByText(`Route Nodes: ${mockRouteData.route.length}`)).toBeInTheDocument();
      });
    });
  });

  describe('Data Validation', () => {
    test('should handle QR ID with special characters', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      const specialId = 'qr-123_456!@#';
      render(<EmergencyMap qrId={specialId} />);

      await waitFor(() => {
        expect(routeService.getRoute).toHaveBeenCalledWith(specialId);
      });
    });

    test('should handle QR ID with maximum length', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      const longId = 'a'.repeat(499);
      render(<EmergencyMap qrId={longId} />);

      await waitFor(() => {
        expect(routeService.getRoute).toHaveBeenCalledWith(longId);
      });
    });

    test('should not call API for QR ID exceeding maximum length', async () => {
      const tooLongId = 'a'.repeat(500);
      render(<EmergencyMap qrId={tooLongId} />);

      await waitFor(() => {
        expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
        expect(routeService.getRoute).not.toHaveBeenCalled();
      });
    });

    test('should handle decimal coordinates in route nodes', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue({
        ...mockRouteData,
        route: [
          { x: 123.456, y: 789.012, type: 'path' },
          { x: 234.567, y: 890.123, type: 'exit' },
        ],
      });

      const { container } = render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        const polyline = container.querySelector('polyline.route-path');
        expect(polyline).toHaveAttribute('points');
        const points = polyline?.getAttribute('points');
        expect(points).toContain('123.456');
        expect(points).toContain('789.012');
      });
    });

    test('should handle node labels with special characters', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue({
        ...mockRouteData,
        route: [
          { x: 100, y: 100, type: 'path', label: 'Room A & B' },
          { x: 200, y: 200, type: 'exit', label: 'Exit <Emergency>' },
        ],
      });

      render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Exit Route')).toBeInTheDocument();
      });
    });
  });

  describe('Dependency and Effect Optimization', () => {
    test('should re-fetch route when QR ID changes', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      const { rerender } = render(<EmergencyMap qrId="qr-1" />);

      await waitFor(() => {
        expect(routeService.getRoute).toHaveBeenCalledWith('qr-1');
      });

      // Clear mock to verify new call
      (routeService.getRoute as jest.Mock).mockClear();
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      // Change QR ID
      rerender(<EmergencyMap qrId="qr-2" />);

      await waitFor(() => {
        expect(routeService.getRoute).toHaveBeenCalledWith('qr-2');
      });
    });

    test('should not re-fetch route when other props change', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      const { rerender } = render(<EmergencyMap qrId="qr-1" />);

      await waitFor(() => {
        expect(routeService.getRoute).toHaveBeenCalledTimes(1);
      });

      // Re-render with same QR ID
      rerender(<EmergencyMap qrId="qr-1" />);

      // Should still be called only once
      expect(routeService.getRoute).toHaveBeenCalledTimes(1);
    });

    test('should clear error state when QR ID changes', async () => {
      (routeService.getRoute as jest.Mock).mockRejectedValueOnce(
        new Error('First error')
      );

      const { rerender } = render(<EmergencyMap qrId="qr-1" />);

      await waitFor(() => {
        expect(screen.getByText('First error')).toBeInTheDocument();
      });

      // Change QR ID to a valid one
      (routeService.getRoute as jest.Mock).mockResolvedValueOnce(mockRouteData);

      rerender(<EmergencyMap qrId="qr-2" />);

      await waitFor(() => {
        expect(screen.queryByText('First error')).not.toBeInTheDocument();
        expect(screen.getByText('Emergency Exit Route')).toBeInTheDocument();
      });
    });

    test('should clear route data when QR ID becomes invalid', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      const { rerender } = render(<EmergencyMap qrId="qr-1" />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Exit Route')).toBeInTheDocument();
      });

      // Change to invalid QR ID
      rerender(<EmergencyMap qrId="" />);

      await waitFor(() => {
        expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
        expect(screen.queryByText('Emergency Exit Route')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle route with single node (exit)', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue({
        ...mockRouteData,
        route: [{ x: 100, y: 100, type: 'exit' }],
      });

      const { container } = render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        // Should not render polyline for single node
        const polyline = container.querySelector('polyline.route-path');
        expect(polyline).not.toBeInTheDocument();
      });
    });

    test('should handle route without SVG content', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue({
        ...mockRouteData,
        svgContent: null,
      });

      const { container } = render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        // Should render fallback rectangle
        const rect = container.querySelector('rect');
        expect(rect).toHaveAttribute('fill', '#f5f5f5');
      });
    });

    test('should handle missing building information', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue({
        ...mockRouteData,
        building: null,
      });

      render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        expect(screen.getByText('Emergency Exit Route')).toBeInTheDocument();
        // Building info should not be displayed
        expect(screen.queryByText(/Building:/)).not.toBeInTheDocument();
      });
    });

    test('should handle large route with many nodes', async () => {
      const largeRoute = Array.from({ length: 100 }, (_, i) => ({
        x: i * 10,
        y: i * 10,
        type: i === 99 ? 'exit' : 'path',
      }));

      (routeService.getRoute as jest.Mock).mockResolvedValue({
        ...mockRouteData,
        route: largeRoute,
      });

      const { container } = render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        const nodes = container.querySelectorAll('circle.route-node');
        expect(nodes.length).toBe(100);
      });
    });

    test('should preserve aspect ratio of SVG', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      const { container } = render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        const svg = container.querySelector('svg.floor-map');
        expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
      });
    });
  });

  describe('API Integration', () => {
    test('should call getRoute with correct parameter', async () => {
      (routeService.getRoute as jest.Mock).mockResolvedValue(mockRouteData);

      const qrId = 'test-qr-id-123';
      render(<EmergencyMap qrId={qrId} />);

      await waitFor(() => {
        expect(routeService.getRoute).toHaveBeenCalledWith(qrId);
      });
    });

    test('should not call API when QR ID is null', () => {
      render(<EmergencyMap qrId={null} />);

      expect(routeService.getRoute).not.toHaveBeenCalled();
    });

    test('should not call API when QR ID is empty', () => {
      render(<EmergencyMap qrId="" />);

      expect(routeService.getRoute).not.toHaveBeenCalled();
    });

    test('should handle API timeout gracefully', async () => {
      (routeService.getRoute as jest.Mock).mockRejectedValue(
        new Error('Request timeout')
      );

      render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        expect(screen.getByText('Navigation Error')).toBeInTheDocument();
        expect(screen.getByText('Request timeout')).toBeInTheDocument();
      });
    });

    test('should handle different HTTP error codes', async () => {
      (routeService.getRoute as jest.Mock).mockRejectedValue(
        new Error('404 Not Found')
      );

      render(<EmergencyMap qrId="test-qr-id-123" />);

      await waitFor(() => {
        expect(screen.getByText('Navigation Error')).toBeInTheDocument();
        expect(screen.getByText('404 Not Found')).toBeInTheDocument();
      });
    });
  });
});
