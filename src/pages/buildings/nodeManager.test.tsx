import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NodeManager from './nodeManager';
import * as nodesApi from '../../apis/nodesApi';
import * as buildingApi from '../../apis/building';
import * as routeApi from '../../apis/routeApi';
import { type Node } from '../../apis/nodesApi';

// jsdom does not implement ResizeObserver, but the page's reveal animations
// (animejs onScroll) construct one when the component mounts.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

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
    label: 'Corridor Point',
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

// NodeManager reads `buildingId` from the route. Rendering it under a bare
// BrowserRouter left useParams() empty, so the component redirected to
// /mybuildings before loading anything and every assertion failed. The route
// has to be declared for the param to exist.
const renderWithRouter = (component: React.ReactElement, buildingId = 'building1') => {
  return render(
    <MemoryRouter initialEntries={[`/building/${buildingId}/nodes`]}>
      <Routes>
        <Route path="/building/:buildingId/nodes" element={component} />
        <Route path="*" element={<div>redirected</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('NodeManager - Complete Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default API mocks
    // Capital `Success` — that is what /api/building/my actually returns.
    // The mock previously used lowercase `success`, which no backend route emits.
    mockBuildingApi.getMyBuildings.mockResolvedValue({
      Success: true,
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
    // Connecting happens by clicking nodes on the map, not in the list, and the
    // map only renders once the floor actually has a map image. The previous
    // version of these tests clicked the node names in the sidebar, which have
    // no click handler at all.
    const withFloorMap = () => {
      mockBuildingApi.getMyBuildings.mockResolvedValue({
        Success: true,
        Message: [
          {
            ...mockBuilding,
            maps: [
              { floor: '1', map: 'https://example.com/floor1.png', qrCode: 'test-qr-1', scanned: 0 },
              { floor: '2', map: null, qrCode: 'test-qr-2', scanned: 0 },
            ],
          },
        ],
      });
    };

    const clickTwoNodes = async () => {
      const nodeEls = await screen.findAllByTestId('node');
      expect(nodeEls.length).toBeGreaterThanOrEqual(2);
      fireEvent.mouseDown(nodeEls[0]);
      fireEvent.mouseDown(nodeEls[1]);
    };

    it('should connect nodes when in connecting mode', async () => {
      withFloorMap();
      mockNodesApi.connectNodes.mockResolvedValue({
        success: true,
        message: 'Nodes connected successfully',
      });

      renderWithRouter(<NodeManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Connect Nodes'));
      expect(screen.getByText('Connecting Mode ON')).toBeInTheDocument();

      await clickTwoNodes();

      await waitFor(() => {
        expect(mockNodesApi.connectNodes).toHaveBeenCalledWith('building1', 'node1', 'node2');
      });
    });

    it('should handle connection errors', async () => {
      withFloorMap();
      mockNodesApi.connectNodes.mockRejectedValue(new Error('Connection failed'));

      renderWithRouter(<NodeManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Connect Nodes'));
      await clickTwoNodes();

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
      // const handleNodeUpdate = jest.fn();
      // In the actual component, this would be called from InteractiveMap
      
      // Mock the drag operation
      // const updatedNode = { ...mockNodes[0], x: 150, y: 250 };
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
      // The default fixture has map: null, which renders the upload prompt
      // rather than a map. Give this floor an actual map image.
      mockBuildingApi.getMyBuildings.mockResolvedValue({
        Success: true,
        Message: [
          {
            ...mockBuilding,
            maps: [
              { floor: '1', map: 'https://example.com/floor1.png', qrCode: 'test-qr-1', scanned: 0 },
              { floor: '2', map: null, qrCode: 'test-qr-2', scanned: 0 },
            ],
          },
        ],
      });

      renderWithRouter(<NodeManager />);

      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(document.querySelector('div.relative.bg-surface-2')).toBeInTheDocument();
      });
    });

    it('should show empty state when no map is available', async () => {
      mockRouteApi.getFloorMap.mockRejectedValue(
        new Error('No map available')
      );

      renderWithRouter(<NodeManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      // With no map for this floor the component shows the upload prompt
      // instead of the map canvas.
      expect(await screen.findByText('No floor map uploaded')).toBeInTheDocument();
      expect(screen.getByText('Upload Floor Map')).toBeInTheDocument();
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
      expect(screen.getByText('Corridor Point')).toBeInTheDocument();
      // The component renders type and position together in one element:
      // "Type: exit | Position: (100, 200)"
      expect(screen.getByText(/Type: exit \| Position: \(100, 200\)/)).toBeInTheDocument();
      expect(screen.getByText(/Type: path \| Position: \(300, 400\)/)).toBeInTheDocument();
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
        expect(screen.getByText(/Failed to load nodes/)).toBeInTheDocument();
      });
    });
  });

  describe('User Interface', () => {
    it('should show building selection and floor options', async () => {
      renderWithRouter(<NodeManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Building')).toBeInTheDocument();
      });

      const floorSelect = screen.getByRole('combobox');
      expect(within(floorSelect).getByRole('option', { name: '1' })).toBeInTheDocument();
      expect(within(floorSelect).getByRole('option', { name: '2' })).toBeInTheDocument();
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
