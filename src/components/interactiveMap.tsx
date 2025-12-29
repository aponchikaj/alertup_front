import { useState, useRef, useEffect, useCallback } from 'react';
import { type Node } from '../apis/nodesApi';

interface InteractiveMapProps {
  svgContent: string | null;
  nodes: Node[];
  selectedFloor: number;
  onNodeClick: (nodeId: string) => void;
  selectedNode: string | null;
  hoveredNode: string | null;
  onNodeHover: (nodeId: string | null) => void;
  onNodeUpdate?: (nodeId: string, x: number, y: number) => void;
  width?: number;
  height?: number;
}

const InteractiveMap = ({ 
  svgContent, 
  nodes, 
  selectedFloor, 
  onNodeClick, 
  selectedNode, 
  hoveredNode, 
  onNodeHover,
  onNodeUpdate,
  width = 800,
  height = 600
}: InteractiveMapProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  
  // New states for coordinate display and input
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showCoordinateInput, setShowCoordinateInput] = useState(false);
  const [inputCoordinates, setInputCoordinates] = useState({ x: '', y: '' });
  const [selectedNodeForCoords, setSelectedNodeForCoords] = useState<string | null>(null);

  // Filter nodes for current floor
  const floorNodes = nodes.filter(n => n.floorNumber === selectedFloor);

  // Reset view when SVG content changes
  useEffect(() => {
    if (svgContent) {
      setScale(1);
      setTranslateX(0);
      setTranslateY(0);
    }
  }, [svgContent]);

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.1), 5);
    
    // Get mouse position relative to container
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate new translation to zoom towards mouse position
    const scaleChange = newScale - scale;
    const newTranslateX = translateX - (mouseX - width / 2) * scaleChange;
    const newTranslateY = translateY - (mouseY - height / 2) * scaleChange;
    
    setScale(newScale);
    setTranslateX(newTranslateX);
    setTranslateY(newTranslateY);
  }, [scale, translateX, translateY, width, height]);

  // Handle mouse down for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !e.shiftKey) { // Left click without shift
      setIsDragging(true);
      setDragStart({ x: e.clientX - translateX, y: e.clientY - translateY });
      setIsPanning(true);
    }
  }, [translateX, translateY]);

  // Convert screen coordinates to SVG coordinates
  const screenToSvgCoords = useCallback((screenX: number, screenY: number) => {
    const baseX = (screenX - translateX) / scale;
    const baseY = (screenY - translateY) / scale;
    const svgX = (baseX / width) * 1000;
    const svgY = (baseY / height) * 800;
    return { x: Math.round(svgX), y: Math.round(svgY) };
  }, [width, height, scale, translateX, translateY]);

  // Handle node mouse down for dragging
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (e.shiftKey && onNodeUpdate) {
      // Start dragging node
      setDraggedNode(node._id);
      setIsPanning(false); // Disable panning while dragging
    } else {
      // Regular node click
      onNodeClick(node._id);
    }
  }, [onNodeClick, onNodeUpdate]);

  // Handle node click for coordinate input
  const handleNodeRightClick = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    e.stopPropagation();
    
    setSelectedNodeForCoords(node._id);
    setInputCoordinates({
      x: node.x.toString(),
      y: node.y.toString()
    });
    setShowCoordinateInput(true);
  }, []);

  // Update node coordinates from input
  const handleUpdateCoordinates = useCallback(() => {
    if (selectedNodeForCoords && onNodeUpdate) {
      const x = parseInt(inputCoordinates.x);
      const y = parseInt(inputCoordinates.y);
      
      if (!isNaN(x) && !isNaN(y) && x >= 0 && y >= 0) {
        onNodeUpdate(selectedNodeForCoords, x, y);
        setShowCoordinateInput(false);
        setSelectedNodeForCoords(null);
        setInputCoordinates({ x: '', y: '' });
      }
    }
  }, [selectedNodeForCoords, inputCoordinates, onNodeUpdate]);

  // Handle mouse move for panning, node dragging, and coordinate tracking
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Update mouse position for coordinate display
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setMousePosition({ x: mouseX, y: mouseY });
    
    if (draggedNode && onNodeUpdate) {
      // Update node position
      const baseX = (mouseX - translateX) / scale;
      const baseY = (mouseY - translateY) / scale;
      
      // Convert base coordinates to SVG coordinates
      const svgX = (baseX / width) * 1000;
      const svgY = (baseY / height) * 800;
      
      onNodeUpdate(draggedNode, Math.round(svgX), Math.round(svgY));
    } else if (isDragging && isPanning) {
      // Handle panning
      const newTranslateX = e.clientX - dragStart.x;
      const newTranslateY = e.clientY - dragStart.y;
      setTranslateX(newTranslateX);
      setTranslateY(newTranslateY);
    }
  }, [draggedNode, onNodeUpdate, isDragging, isPanning, dragStart, width, height, scale, translateX, translateY]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (draggedNode) {
      setDraggedNode(null);
    }
    setIsDragging(false);
    setIsPanning(false);
  }, [draggedNode]);

  // Calculate node positions with map transformation
  const getNodePosition = useCallback((node: Node) => {
    // Assuming SVG viewBox is 1000x800, scale positions accordingly
    const svgWidth = 1000;
    const svgHeight = 800;
    const baseX = (node.x / svgWidth) * width;
    const baseY = (node.y / svgHeight) * height;
    
    // Apply map transformation
    const transformedX = baseX * scale + translateX;
    const transformedY = baseY * scale + translateY;
    
    return { x: transformedX, y: transformedY };
  }, [width, height, scale, translateX, translateY]);

  // Render connections between nodes
  const renderConnections = useCallback(() => {
    const connections: JSX.Element[] = [];
    
    floorNodes.forEach(node => {
      node.connections.forEach(connectedNodeId => {
        const connectedNode = floorNodes.find(n => n._id === connectedNodeId);
        if (connectedNode) {
          const fromPos = getNodePosition(node);
          const toPos = getNodePosition(connectedNode);
          
          // Only render each connection once
          const connectionId = [node._id, connectedNodeId].sort().join('-');
          if (!connections.find(c => c.key === connectionId)) {
            connections.push(
              <line
                key={connectionId}
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke="#FF7B22"
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.7"
              />
            );
          }
        }
      });
    });
    
    return connections;
  }, [floorNodes, getNodePosition]);

  // Handle node click
  const handleNodeClick = useCallback((e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    if (!isPanning && !draggedNode) {
      onNodeClick(node._id);
    }
  }, [onNodeClick, isPanning, draggedNode]);

  // Handle node hover
  const handleNodeHover = useCallback((node: Node | null) => {
    onNodeHover(node?._id || null);
  }, [onNodeHover]);

  // Reset view
  const resetView = useCallback(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, []);

  // Zoom in/out
  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * 1.2, 5));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(prev * 0.8, 0.1));
  }, []);

  return (
    <div className="relative bg-gray-100 rounded-lg overflow-hidden border border-gray-300" style={{ width, height }}>
      {/* Map Container */}
      <div
        ref={containerRef}
        className="relative w-full h-full cursor-move"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {svgContent ? (
          <svg
            ref={svgRef}
            className="absolute inset-0"
            viewBox={`0 0 1000 800`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
              transformOrigin: 'center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="text-gray-600 font-medium">No map available for this floor</p>
              <p className="text-sm text-gray-500 mt-2">Upload an SVG or convert an image to get started</p>
            </div>
          </div>
        )}

        {/* Connections Layer */}
        {svgContent && (
          <svg className="absolute inset-0 pointer-events-none" style={{ width, height }}>
            {renderConnections()}
          </svg>
        )}

        {/* Node Overlays */}
        {svgContent && floorNodes.map(node => {
          const position = getNodePosition(node);
          const isSelected = selectedNode === node._id;
          const isHovered = hoveredNode === node._id;
          
          return (
            <div
              key={node._id}
              data-testid="node"
              className={`absolute w-4 h-4 rounded-full cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
                node.type === 'exit' ? 'bg-green-500' :
                node.type === 'stairs' ? 'bg-blue-500' : 'bg-yellow-500'
              } ${
                isSelected ? 'ring-4 ring-white ring-opacity-60 scale-150 z-20' : ''
              } ${
                isHovered ? 'ring-2 ring-yellow-300 scale-125 z-10' : ''
              } ${
                draggedNode === node._id ? 'cursor-grabbing ring-4 ring-blue-400 scale-125 z-30' : ''
              } ${
                isPanning ? 'pointer-events-none' : 'pointer-events-auto'
              }`}
              style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: `translate(-50%, -50%) scale(${scale}) ${isSelected ? 'scale(1.5)' : ''} ${isHovered ? 'scale(1.25)' : ''} ${draggedNode === node._id ? 'scale(1.25)' : ''}`
              }}
              onClick={(e) => handleNodeClick(e, node)}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              onMouseEnter={() => handleNodeHover(node)}
              onMouseLeave={() => handleNodeHover(null)}
              onContextMenu={(e) => handleNodeRightClick(e, node)}
              title={`${node.label || `${node.type} (${node.x}, ${node.y})`} - Right-click to edit coordinates`}
            />
          );
        })}

        {/* Coordinate Display */}
        <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded pointer-events-none">
          <div>Mouse: ({Math.round(mousePosition.x)}, {Math.round(mousePosition.y)})</div>
          <div>SVG: ({Math.round(screenToSvgCoords(mousePosition.x, mousePosition.y).x)}, {Math.round(screenToSvgCoords(mousePosition.x, mousePosition.y).y)})</div>
          <div>Zoom: {Math.round(scale * 100)}%</div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={zoomIn}
          className="w-10 h-10 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center transition-colors shadow-md"
          title="Zoom In"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        
        <button
          onClick={zoomOut}
          className="w-10 h-10 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center transition-colors shadow-md"
          title="Zoom Out"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        
        <button
          onClick={resetView}
          className="w-10 h-10 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center transition-colors shadow-md"
          title="Reset View"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Zoom Indicator */}
      <div className="absolute bottom-4 right-4 bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded-lg text-sm shadow-md">
        {Math.round(scale * 100)}%
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-xs max-w-xs shadow-md">
        <p>🖱️ Scroll to zoom</p>
        <p>🤚 Click & drag to pan</p>
        <p>📍 Click nodes to select</p>
        <p>⚡ Shift+drag nodes to move</p>
        <p>🎯 Right-click nodes to edit coords</p>
      </div>

      {/* Coordinate Input Modal */}
      {showCoordinateInput && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">Edit Node Coordinates</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">X Coordinate:</label>
                <input
                  type="number"
                  value={inputCoordinates.x}
                  onChange={(e) => setInputCoordinates(prev => ({ ...prev, x: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter X coordinate (0-1000)"
                  min="0"
                  max="1000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Y Coordinate:</label>
                <input
                  type="number"
                  value={inputCoordinates.y}
                  onChange={(e) => setInputCoordinates(prev => ({ ...prev, y: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Y coordinate (0-800)"
                  min="0"
                  max="800"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateCoordinates}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                Update
              </button>
              <button
                onClick={() => {
                  setShowCoordinateInput(false);
                  setSelectedNodeForCoords(null);
                  setInputCoordinates({ x: '', y: '' });
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveMap;
