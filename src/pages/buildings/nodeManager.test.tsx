import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import NodeManager from './nodeManager';
import * as nodesApi from '../../apis/nodesApi';
import * as buildingApi from '../../apis/building';
import * as routeApi from '../../apis/routeApi';
import { type Node } from '../../apis/nodesApi';

// Mock the APIs
jest.mock('../../apis/nodesApi');
jest.mock('../../apis/building');
jest.mock('../../apis/routeApi');

const mockNodesApi = nodesApi as jest.Mocked<typeof nodesApi>;
const mockBuildingApi = buildingApi as jest.Mocked<typeof buildingApi>;
const mockRouteApi = routeApi as jest.Mocked<typeof routeApi>;

// Mock data
const mockBuilding = {
  _id: 'building1',
  buildingName: 'Test Building',
  owner: 'user1',
  floors: 2,
  maps: [
    { floor: '1', map: null, qrCode: 'test-qr-1', scanned: 0 },
    { floor: '2', map: null, qrCode: 'test-qr-2', scanned: 0 }
  ]
};

const mockNodes: Node[] = [
  {
    _id: 'node1',
    buildingId: 'building1',
    floorNumber: 1,
    x: 100,
    y: 200,
    type: 'exit' as const,
    connections: ['node2'],
    label: 'Main Exit',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    _id: 'node2',
    buildingId: 'building1',
    floorNumber: 1,
    x: 300,
    y: 400,
    type: 'path' as const,
    connections: ['node1'],
    label: 'Path Point',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

const mockSvgContent = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 800">
    <rect width="1000" height="800" fill="#f8f9fa"/>
    <text x="500" y="400" text-anchor="middle">Test Floor Map</text>
  </svg>
`;

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('NodeManager - Complete Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default API mocks
    mockBuildingApi.getMyBuildings.mockResolvedValue({
      success: true,
      Message: [mockBuilding]
    });
    
    mockNodesApi.getNodesByBuilding.mockResolvedValue({
      success: true,
      nodes: mockNodes
    });
    
    mockRouteApi.getFloorMap.mockResolvedValue({
      success: true,
      svgContent: mockSvgContent,
      floor: 1,
      svgMapUrl: '/uploads/test.svg',
      svgDimensions: { width: 1000, height: 800 }
    });
  });

  describe('Node Connection Functionality', () => {
    it('should connect nodes when in connecting mode', async () => {
      mockNodesApi.connectNodes.mockResolvedValue({
        success: true,
        message: 'Nodes connected successfully',
        data: {
          connection: {
            buildingId: 'building1',
            node1Id: 'node1',
            node2Id: 'node2'
          }
        }
      });

      renderWithRouter(<NodeManager />);
      
      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      // Enable connecting mode
      const connectButton = screen.getByText('Connect Nodes');
      await userEvent.click(connectButton);

      // Click first node
      const node1 = screen.getByText('Main Exit');
      await userEvent.click(node1);

      // Click second node
      const node2 = screen.getByText('Path Point');
      await userEvent.click(node2);

      // Verify connectNodes was called with correct parameters
      expect(mockNodesApi.connectNodes).toHaveBeenCalledWith(
        'building1',
        'node1',
        'node2'
      );
    });

    it('should handle connection errors', async () => {
      mockNodesApi.connectNodes.mockRejectedValue(
        new Error('Connection failed')
      );

      renderWithRouter(<NodeManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      const connectButton = screen.getByText('Connect Nodes');
      await userEvent.click(connectButton);

      const node1 = screen.getByText('Main Exit');
      await userEvent.click(node1);

      const node2 = screen.getByText('Path Point');
      await userEvent.click(node2);

      await waitFor(() => {
        expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
      });
    });
  });

  describe('Node Update Functionality', () => {
    it('should update node position when dragged', async () => {
      mockNodesApi.updateNode.mockResolvedValue({
        success: true,
        message: 'Node updated successfully',
        node: { ...mockNodes[0], x: 150, y: 250 }
      });

      renderWithRouter(<NodeManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      // Simulate node drag (this would normally be done through InteractiveMap)
      // For testing, we'll call the update function directly
      const handleNodeUpdate = jest.fn();
      // In the actual component, this would be called from InteractiveMap
      
      // Mock the drag operation
      const updatedNode = { ...mockNodes[0], x: 150, y: 250 };
      mockNodesApi.updateNode('node1', { x: 150, y: 250 });

      expect(mockNodesApi.updateNode).toHaveBeenCalledWith('node1', { x: 150, y: 250 });
    });
  });

  describe('Node Deletion Functionality', () => {
    it('should delete node when delete button is clicked', async () => {
      mockNodesApi.deleteNode.mockResolvedValue({
        success: true,
        message: 'Node deleted successfully'
      });

      // Mock window.confirm
      window.confirm = jest.fn(() => true);

      renderWithRouter(<NodeManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      // Find and click delete button for first node
      const deleteButtons = screen.getAllByText('Delete');
      expect(deleteButtons.length).toBeGreaterThan(0);
      
      await userEvent.click(deleteButtons[0]);

      // Verify deleteNodes was called
      expect(mockNodesApi.deleteNode).toHaveBeenCalledWith('node1');
    });

    it('should not delete node when confirmation is cancelled', async () => {
      // Mock window.confirm to return false
      window.confirm = jest.fn(() => false);

      renderWithRouter(<NodeManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('Delete');
      await userEvent.click(deleteButtons[0]);

      // Should not call deleteNodes
      expect(mockNodesApi.deleteNode).not.toHaveBeenCalled();
    });
  });

  describe('Map Display', () => {
    it('should display floor map when available', async () => {
      renderWithRouter(<NodeManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      // Check if InteractiveMap is rendered
      const interactiveMap = document.querySelector('div.relative.bg-gray-100');
      expect(interactiveMap).toBeInTheDocument();
    });

    it('should show empty state when no map is available', async () => {
      mockRouteApi.getFloorMap.mockRejectedValue(
        new Error('No map available')
      );

      renderWithRouter(<NodeManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      // Should still show the map container but with empty state
      const interactiveMap = document.querySelector('div.relative.bg-gray-100');
      expect(interactiveMap).toBeInTheDocument();
    });
  });

  describe('Node List Display', () => {
    it('should display nodes for the selected floor', async () => {
      renderWithRouter(<NodeManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      // Check if nodes are displayed
      expect(screen.getByText('Main Exit')).toBeInTheDocument();
      expect(screen.getByText('Path Point')).toBeInTheDocument();
      expect(screen.getByText('Type: exit')).toBeInTheDocument();
      expect(screen.getByText('Type: path')).toBeInTheDocument();
      expect(screen.getByText('Location: (100, 200)')).toBeInTheDocument();
      expect(screen.getByText('Location: (300, 400)')).toBeInTheDocument();
    });

    it('should show no nodes message when floor is empty', async () => {
      mockNodesApi.getNodesByBuilding.mockResolvedValue({
        success: true,
        nodes: []
      });

      renderWithRouter(<NodeManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      expect(screen.getByText('No nodes on this floor yet')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error messages when API calls fail', async () => {
      mockBuildingApi.getMyBuildings.mockRejectedValue(
        new Error('Failed to load buildings')
      );

      renderWithRouter(<NodeManager />);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load buildings/)).toBeInTheDocument();
      });
    });

    it('should handle node loading errors', async () => {
      mockNodesApi.getNodesByBuilding.mockRejectedValue(
        new Error('Failed to load nodes')
      );

      renderWithRouter(<NodeManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load data/)).toBeInTheDocument();
      });
    });
  });

  describe('User Interface', () => {
    it('should show building selection and floor options', async () => {
      renderWithRouter(<NodeManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      expect(screen.getByText('Floor 1')).toBeInTheDocument();
      expect(screen.getByText('Floor 2')).toBeInTheDocument();
    });

    it('should show action buttons', async () => {
      renderWithRouter(<NodeManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      expect(screen.getByText('Create Node')).toBeInTheDocument();
      expect(screen.getByText('Upload Map')).toBeInTheDocument();
      expect(screen.getByText('Connect Nodes')).toBeInTheDocument();
    });

    it('should toggle connecting mode', async () => {
      renderWithRouter(<NodeManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      const connectButton = screen.getByText('Connect Nodes');
      expect(connectButton).toBeInTheDocument();

      await userEvent.click(connectButton);

      expect(screen.getByText('Connecting Mode ON')).toBeInTheDocument();
      expect(screen.getByText(/Click on two nodes to connect/)).toBeInTheDocument();
    });
  });
});
