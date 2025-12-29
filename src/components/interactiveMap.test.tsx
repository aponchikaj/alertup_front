import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import InteractiveMap from './interactiveMap';
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

describe('InteractiveMap Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state when no SVG content', () => {
    renderWithRouter(<InteractiveMap {...defaultProps} />);
    
    expect(screen.getByText('No map available for this floor')).toBeInTheDocument();
    expect(screen.getByText('Upload an SVG or convert an image to get started')).toBeInTheDocument();
  });

  it('renders SVG content when provided', () => {
    renderWithRouter(
      <InteractiveMap {...defaultProps} svgContent={mockSvgContent} />
    );
    
    const svgElement = document.querySelector('svg');
    expect(svgElement).toBeInTheDocument();
    expect(svgElement?.getAttribute('viewBox')).toBe('0 0 1000 800');
  });

  it('renders nodes for the selected floor', () => {
    renderWithRouter(
      <InteractiveMap {...defaultProps} svgContent={mockSvgContent} />
    );
    
    // Check that nodes are rendered
    const nodeElements = document.querySelectorAll('[data-testid="node"]');
    expect(nodeElements.length).toBe(2); // Both nodes are on floor 1
  });

  it('filters nodes by floor number', () => {
    const nodesOnMultipleFloors = [
      ...mockNodes,
      {
        ...mockNodes[0],
        _id: 'node3',
        floorNumber: 2,
        x: 500,
        y: 500
      }
    ];

    renderWithRouter(
      <InteractiveMap 
        {...defaultProps} 
        nodes={nodesOnMultipleFloors}
        svgContent={mockSvgContent}
      />
    );
    
    // Should only show nodes from floor 1
    const nodeElements = document.querySelectorAll('[data-testid="node"]');
    expect(nodeElements.length).toBe(2);
  });

  it('handles node clicks', async () => {
    const mockOnNodeClick = jest.fn();
    const user = userEvent.setup();
    
    renderWithRouter(
      <InteractiveMap 
        {...defaultProps} 
        onNodeClick={mockOnNodeClick}
        svgContent={mockSvgContent}
      />
    );
    
    const firstNode = document.querySelector('[data-testid="node"]');
    expect(firstNode).toBeInTheDocument();
    
    if (firstNode) {
      await user.click(firstNode);
      expect(mockOnNodeClick).toHaveBeenCalledWith('node1');
    }
  });

  it('handles node hover', async () => {
    const mockOnNodeHover = jest.fn();
    const user = userEvent.setup();
    
    renderWithRouter(
      <InteractiveMap 
        {...defaultProps} 
        onNodeHover={mockOnNodeHover}
        svgContent={mockSvgContent}
      />
    );
    
    const firstNode = document.querySelector('[data-testid="node"]');
    expect(firstNode).toBeInTheDocument();
    
    if (firstNode) {
      await user.hover(firstNode);
      expect(mockOnNodeHover).toHaveBeenCalledWith('node1');
      
      await user.unhover(firstNode);
      expect(mockOnNodeHover).toHaveBeenCalledWith(null);
    }
  });

  it('applies correct node colors based on type', () => {
    renderWithRouter(
      <InteractiveMap {...defaultProps} svgContent={mockSvgContent} />
    );
    
    const nodeElements = document.querySelectorAll('[data-testid="node"]');
    
    // First node is exit type (green)
    expect(nodeElements[0]).toHaveClass('bg-green-500');
    
    // Second node is path type (yellow)
    expect(nodeElements[1]).toHaveClass('bg-yellow-500');
  });

  it('shows zoom controls', () => {
    renderWithRouter(
      <InteractiveMap {...defaultProps} svgContent={mockSvgContent} />
    );
    
    expect(screen.getByTitle('Zoom In')).toBeInTheDocument();
    expect(screen.getByTitle('Zoom Out')).toBeInTheDocument();
    expect(screen.getByTitle('Reset View')).toBeInTheDocument();
  });

  it('shows zoom percentage', () => {
    renderWithRouter(
      <InteractiveMap {...defaultProps} svgContent={mockSvgContent} />
    );
    
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows instructions', () => {
    renderWithRouter(
      <InteractiveMap {...defaultProps} svgContent={mockSvgContent} />
    );
    
    expect(screen.getByText('🖱️ Scroll to zoom')).toBeInTheDocument();
    expect(screen.getByText('🤚 Click & drag to pan')).toBeInTheDocument();
    expect(screen.getByText('📍 Click nodes to select')).toBeInTheDocument();
  });

  it('handles zoom in button click', async () => {
    const user = userEvent.setup();
    
    renderWithRouter(
      <InteractiveMap {...defaultProps} svgContent={mockSvgContent} />
    );
    
    const zoomInButton = screen.getByTitle('Zoom In');
    await user.click(zoomInButton);
    
    // Should show increased zoom
    expect(screen.getByText('120%')).toBeInTheDocument();
  });

  it('handles zoom out button click', async () => {
    const user = userEvent.setup();
    
    renderWithRouter(
      <InteractiveMap {...defaultProps} svgContent={mockSvgContent} />
    );
    
    const zoomOutButton = screen.getByTitle('Zoom Out');
    await user.click(zoomOutButton);
    
    // Should show decreased zoom
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('handles reset view button click', async () => {
    const user = userEvent.setup();
    
    renderWithRouter(
      <InteractiveMap {...defaultProps} svgContent={mockSvgContent} />
    );
    
    // Zoom in first
    const zoomInButton = screen.getByTitle('Zoom In');
    await user.click(zoomInButton);
    expect(screen.getByText('120%')).toBeInTheDocument();
    
    // Reset view
    const resetButton = screen.getByTitle('Reset View');
    await user.click(resetButton);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
