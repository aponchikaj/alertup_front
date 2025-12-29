import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { jest } from '@jest/globals';
import RouteDisplay from './routeDisplay';
import * as routeApi from '../../apis/routeApi';
import type { RouteResponse } from '../../apis/routeApi';

// Mock the routeApi module
jest.mock('../../apis/routeApi');
const mockGetRouteByQR = routeApi.getRouteByQR as jest.MockedFunction<typeof routeApi.getRouteByQR>;

// Mock PageHeader component
jest.mock('../../components/pageHeader', () => {
  return function MockPageHeader({ title }: { title: string }) {
    return <div data-testid="page-header">{title}</div>;
  };
});

// Mock Link component
jest.mock('react-router-dom', () => ({
  BrowserRouter: require('react-router-dom').BrowserRouter,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('RouteDisplay Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockGetRouteByQR.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    renderWithRouter(<RouteDisplay />);
    
    expect(screen.getByText('Calculating emergency route...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
  });

  it('should display route data when API call succeeds', async () => {
    const mockRouteData = {
      success: true,
      floor: 1,
      building: 'Test Building',
      svgMapUrl: 'test-map.svg',
      svgContent: '<svg>...</svg>',
      svgDimensions: {
        width: 1000,
        height: 800,
      },
      route: [
        { x: 100, y: 100, type: 'path' },
        { x: 200, y: 200, type: 'path' },
        { x: 300, y: 300, type: 'exit', label: 'Main Exit' },
      ],
      startPoint: {
        x: 100,
        y: 100,
      },
    };

    mockGetRouteByQR.mockResolvedValue(mockRouteData);

    renderWithRouter(<RouteDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Emergency Exit Route')).toBeInTheDocument();
      expect(screen.getByText('Building: Test Building | Floor: 1')).toBeInTheDocument();
      expect(screen.getByText('Distance: 28.3m')).toBeInTheDocument();
      expect(screen.getByText('Est. Time: 24s')).toBeInTheDocument();
    });
  });

  it('should display error message when API call fails', async () => {
    const errorMessage = 'Route not found';
    mockGetRouteByQR.mockRejectedValue(new Error(errorMessage));

    renderWithRouter(<RouteDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Route Error')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByText('Try Another QR Code')).toBeInTheDocument();
    });
  });

  it('should display error when no QR ID is provided', async () => {
    renderWithRouter(<RouteDisplay />);

    await waitFor(() => {
      expect(screen.getByText('No QR code provided')).toBeInTheDocument();
    });
  });

  it('should display fallback message when SVG content is missing', async () => {
    const mockRouteData: RouteResponse = {
      success: true,
      floor: 1,
      building: 'Test Building',
      svgMapUrl: undefined,
      svgContent: undefined,
      svgDimensions: {
        width: 1000,
        height: 800,
      },
      route: [
        { x: 100, y: 100, type: 'exit', label: 'Main Exit' },
      ],
      startPoint: {
        x: 100,
        y: 100,
      },
    };

    mockGetRouteByQR.mockResolvedValue(mockRouteData);

    renderWithRouter(<RouteDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Map not available')).toBeInTheDocument();
    });
  });

  it('should have correct page title', () => {
    mockGetRouteByQR.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    renderWithRouter(<RouteDisplay />);
    
    expect(document.title).toBe('Emergency Route - AlertUp');
  });

  it('should have back navigation', async () => {
    mockGetRouteByQR.mockResolvedValue({
      success: true,
      floor: 1,
      building: 'Test Building',
      svgDimensions: { width: 1000, height: 800 },
      route: [{ x: 100, y: 100, type: 'exit' }],
      startPoint: { x: 100, y: 100 },
    });

    renderWithRouter(<RouteDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Scan Another QR Code')).toBeInTheDocument();
    });

    const scanLink = screen.getByText('Scan Another QR Code');
    expect(scanLink.closest('a')).toHaveAttribute('href', '/scan');
  });

  it('should display route legend', async () => {
    const mockRouteData = {
      success: true,
      floor: 1,
      building: 'Test Building',
      svgDimensions: { width: 1000, height: 800 },
      route: [
        { x: 100, y: 100, type: 'path' },
        { x: 200, y: 200, type: 'exit', label: 'Main Exit' },
      ],
      startPoint: { x: 100, y: 100 },
    };

    mockGetRouteByQR.mockResolvedValue(mockRouteData);

    renderWithRouter(<RouteDisplay />);

    await waitFor(() => {
      expect(screen.getByText('Your Location')).toBeInTheDocument();
      expect(screen.getByText('Path')).toBeInTheDocument();
      expect(screen.getByText('Emergency Exit')).toBeInTheDocument();
    });
  });
});
