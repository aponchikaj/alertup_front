import { render, screen, fireEvent } from '@testing-library/react';
// import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import InteractiveMap from './interactiveMapImproved';
import { type Node } from '../apis/nodesApi';

// Mock data
const mockNodes: Node[] = [
  {
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
  },
  {
    _id: 'node2',
    buildingId: 'building1',
    floorNumber: 1,
    x: 300,
    y: 400,
    type: 'path',
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

const defaultProps = {
  svgContent: null,
  nodes: mockNodes,
  selectedFloor: 1,
  onNodeClick: jest.fn(),
  selectedNode: null,
  hoveredNode: null,
  onNodeHover: jest.fn(),
  width: 800,
  height: 600
};

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('InteractiveMap Node Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nodes with connections', () => {
    renderWithRouter(
      <InteractiveMap {...defaultProps} svgContent={mockSvgContent} />
    );
    
    const nodeElements = document.querySelectorAll('[data-testid="node"]');
    expect(nodeElements.length).toBe(2);
    
    // Check for connections
    const connectionsLayer = document.querySelector('svg.pointer-events-none');
    const connectionLines = connectionsLayer?.querySelectorAll('line');
    expect(connectionLines?.length).toBe(1);
  });

  it('handles node dragging with shift key', async () => {
    const mockOnNodeUpdate = jest.fn();
    // const user = userEvent.setup();
    
    renderWithRouter(
      <InteractiveMap 
        {...defaultProps} 
        onNodeUpdate={mockOnNodeUpdate}
        svgContent={mockSvgContent}
      />
    );
    
    const firstNode = document.querySelector('[data-testid="node"]');
    expect(firstNode).toBeInTheDocument();
    
    if (firstNode) {
      // Simulate shift+click and drag
      fireEvent.mouseDown(firstNode, { shiftKey: true });
      fireEvent.mouseMove(firstNode, { clientX: 200, clientY: 300 });
      fireEvent.mouseUp(firstNode);
      
      // Should have called onNodeUpdate
      expect(mockOnNodeUpdate).toHaveBeenCalledWith('node1', expect.any(Number), expect.any(Number));
    }
  });

  it('shows drag instructions', () => {
    renderWithRouter(
      <InteractiveMap {...defaultProps} svgContent={mockSvgContent} />
    );
    
    expect(screen.getByText('Shift+drag nodes to move')).toBeInTheDocument();
  });

  it('filters nodes by floor', () => {
    renderWithRouter(
      <InteractiveMap 
        {...defaultProps} 
        selectedFloor={2}
        svgContent={mockSvgContent}
      />
    );
    
    const nodeElements = document.querySelectorAll('[data-testid="node"]');
    expect(nodeElements.length).toBe(0); // No nodes on floor 2
  });
});
