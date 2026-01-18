import { useState, useRef, useEffect, useCallback } from 'react';
import { type Node } from '../apis/nodesApi';

interface InteractiveMapProps {
  svgContent: string | null;
  floorMapUrl?: string | null;
  nodes: Node[];
  selectedFloor: number;
  onNodeClick: (nodeId: string) => void;
  selectedNode: string | null;
  hoveredNode: string | null;
  onNodeHover: (nodeId: string | null) => void;
  onNodeUpdate?: (nodeId: string, x: number, y: number) => void;
  onCreateNode?: (x: number, y: number) => void;
  createMode?: boolean;
  width?: number;
  height?: number;
}

const InteractiveMap = ({ 
  svgContent, 
  floorMapUrl,
  nodes, 
  selectedFloor, 
  onNodeClick, 
  selectedNode, 
  hoveredNode, 
  onNodeHover,
  onNodeUpdate,
  onCreateNode,
  createMode = false,
  width = 800,
  height = 600
}: InteractiveMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Transform state
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  
  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  
  // Coordinate tracking
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [svgCoordinates, setSvgCoordinates] = useState({ x: 0, y: 0 });

  // Filter nodes for current floor
  const floorNodes = nodes.filter(n => n.floorNumber === selectedFloor);

  // Node dragging optimization
  const [draggedNodePosition, setDraggedNodePosition] = useState<{x: number, y: number} | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset view when SVG content changes
  useEffect(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, [svgContent]);

  // Convert screen coordinates to SVG coordinates
  const screenToSvgCoords = useCallback((screenX: number, screenY: number) => {
    const svgWidth = 1000;
    const svgHeight = 800;
    
    // Calculate the scale factor from SVG to container
    const scaleX = width / svgWidth;
    const scaleY = height / svgHeight;
    
    // Reverse the zoom and pan transforms
    const containerX = (screenX - translateX) / scale;
    const containerY = (screenY - translateY) / scale;
    
    // Convert container coordinates to SVG coordinates
    const svgX = containerX / scaleX;
    const svgY = containerY / scaleY;
    
    return { 
      x: Math.round(Math.max(0, Math.min(svgWidth, svgX))), 
      y: Math.round(Math.max(0, Math.min(svgHeight, svgY)))
    };
  }, [width, height, scale, translateX, translateY]);

  // Convert SVG coordinates to screen coordinates
  const svgToScreenCoords = useCallback((svgX: number, svgY: number) => {
    const svgWidth = 1000;
    const svgHeight = 800;
    
    // Calculate the scale factor from SVG to container
    const scaleX = width / svgWidth;
    const scaleY = height / svgHeight;
    
    // Convert SVG coordinates to container coordinates
    const containerX = svgX * scaleX;
    const containerY = svgY * scaleY;
    
    // Apply zoom and pan transforms
    const screenX = containerX * scale + translateX;
    const screenY = containerY * scale + translateY;
    
    return { x: screenX, y: screenY };
  }, [width, height, scale, translateX, translateY]);

  // Handle wheel zoom - DISABLED
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Zoom is disabled
  }, []);

  // Handle mouse down for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !e.shiftKey && !createMode) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - translateX, y: e.clientY - translateY });
    }
  }, [translateX, translateY, createMode]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setMousePosition({ x: mouseX, y: mouseY });
    
    // Update SVG coordinates
    const svgCoords = screenToSvgCoords(mouseX, mouseY);
    setSvgCoordinates(svgCoords);
    
    if (draggedNode) {
      // Update dragged node position locally (no API call)
      setDraggedNodePosition({ x: svgCoords.x, y: svgCoords.y });
      
      // Debounced API update - only update every 100ms
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      updateTimeoutRef.current = setTimeout(() => {
        if (onNodeUpdate && draggedNode) {
          onNodeUpdate(draggedNode, svgCoords.x, svgCoords.y);
        }
      }, 100);
    } else if (isDragging) {
      // Handle panning
      const newTranslateX = e.clientX - dragStart.x;
      const newTranslateY = e.clientY - dragStart.y;
      setTranslateX(newTranslateX);
      setTranslateY(newTranslateY);
    }
  }, [draggedNode, onNodeUpdate, isDragging, dragStart, screenToSvgCoords]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    
    // Clear any pending timeout and update immediately
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
    
    // Final update if node was dragged
    if (draggedNode && draggedNodePosition && onNodeUpdate) {
      onNodeUpdate(draggedNode, draggedNodePosition.x, draggedNodePosition.y);
    }
    
    setDraggedNode(null);
    setDraggedNodePosition(null);
  }, [draggedNode, draggedNodePosition, onNodeUpdate]);

  // Handle node mouse down for dragging
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (e.shiftKey && onNodeUpdate && !createMode) {
      // Start dragging node
      setDraggedNode(node._id);
    } else if (createMode && onCreateNode) {
      // Create new node at this position in create mode
      const svgCoords = screenToSvgCoords(mousePosition.x, mousePosition.y);
      onCreateNode(svgCoords.x, svgCoords.y);
    } else {
      // Regular node click
      onNodeClick(node._id);
    }
  }, [onNodeClick, onNodeUpdate, onCreateNode, createMode, mousePosition, screenToSvgCoords]);

  // Handle node hover
  const handleNodeHover = useCallback((node: Node | null) => {
    onNodeHover(node?._id || null);
  }, [onNodeHover]);

  // Handle map click in create mode
  const handleMapClick = useCallback(() => {
    if (createMode && onCreateNode) {
      const svgCoords = screenToSvgCoords(mousePosition.x, mousePosition.y);
      onCreateNode(svgCoords.x, svgCoords.y);
    }
  }, [createMode, onCreateNode, mousePosition, screenToSvgCoords]);

  // Render connections between nodes
  const renderConnections = useCallback(() => {
    const connections: JSX.Element[] = [];
    
    floorNodes.forEach(node => {
      node.connections.forEach(connectedNodeId => {
        const connectedNode = floorNodes.find(n => n._id === connectedNodeId);
        if (connectedNode) {
          const fromPos = svgToScreenCoords(node.x, node.y);
          const toPos = svgToScreenCoords(connectedNode.x, connectedNode.y);
          
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
  }, [floorNodes, svgToScreenCoords]);

  // Reset view
  const resetView = useCallback(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, []);

  // Zoom controls
  // const zoomIn = useCallback(() => {
  //   setScale(prev => Math.min(prev * 1.2, 5));
  // }, []);

  // const zoomOut = useCallback(() => {
    // setScale(prev => Math.max(prev * 0.8, 0.1));
  // }, []);

  return (
    <div className="relative bg-gray-100 rounded-lg overflow-hidden border border-gray-300 w-full h-full">
      {/* Map Container */}
      <div
        ref={containerRef}
        className={`relative w-full h-full ${createMode ? 'cursor-crosshair' : 'cursor-move'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleMapClick}
      >
        {/* Map Container */}
        {svgContent ? (
          <svg
            ref={svgRef}
            className="absolute inset-0 w-full h-full"
            viewBox={`0 0 1000 800`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
              transformOrigin: 'center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : floorMapUrl ? (
          <div className="absolute inset-0 w-full h-full">
            <img
              src={floorMapUrl}
              alt="Floor Map"
              className="w-full h-full object-contain"
              style={{
                transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                transformOrigin: 'center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
              onLoad={() => console.log('✅ Image loaded successfully:', floorMapUrl)}
              onError={(e) => {
                console.error('❌ Failed to load image:', e);
                console.log('🔍 Image URL that failed:', floorMapUrl);
              }}
            />
          </div>
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
        {(svgContent || floorMapUrl) && (
          <svg className="absolute inset-0 pointer-events-none w-full h-full">
            {renderConnections()}
          </svg>
        )}

        {/* Walls Layer */}
        {(svgContent || floorMapUrl) && (
          <svg className="absolute inset-0 pointer-events-none w-full h-full">
            {/* Walls will be rendered here when implemented */}
          </svg>
        )}

        {/* Node Overlays */}
        {(svgContent || floorMapUrl) && floorNodes.map(node => {
          // Use local position if this node is being dragged, otherwise use original position
          const actualPosition = draggedNode === node._id && draggedNodePosition 
            ? svgToScreenCoords(draggedNodePosition.x, draggedNodePosition.y)
            : svgToScreenCoords(node.x, node.y);
          
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
              }`}
              style={{
                left: `${actualPosition.x}px`,
                top: `${actualPosition.y}px`,
                transition: draggedNode === node._id ? 'none' : 'all 0.2s', // Disable transition while dragging
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              onMouseEnter={() => handleNodeHover(node)}
              onMouseLeave={() => handleNodeHover(null)}
              title={`${node.label || `${node.type} (${node.x}, ${node.y})`} - Shift+drag to move`}
            />
          );
        })}

        {/* Create Mode Cursor Indicator */}
        {createMode && svgContent && (
          <div
            className="absolute w-6 h-6 border-2 border-red-500 rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${mousePosition.x}px`,
              top: `${mousePosition.y}px`,
            }}
          />
        )}

        {/* Coordinate Display */}
        <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded pointer-events-none">
          <div>Mouse: ({Math.round(mousePosition.x)}, {Math.round(mousePosition.y)})</div>
          <div>SVG: ({svgCoordinates.x}, {svgCoordinates.y})</div>
          <div>Zoom: {Math.round(scale * 100)}%</div>
          {createMode && (
            <div className="text-yellow-300 font-bold mt-1">
              Click to place node at ({svgCoordinates.x}, {svgCoordinates.y})
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        {/* <button
          // onClick={zoomIn}
          className="w-10 h-10 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center transition-colors shadow-md"
          title="Zoom In"
        > */}
          {/* <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button> */}
        
        {/* <button
          onClick={zoomOut}
          className="w-10 h-10 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center transition-colors shadow-md"
          title="Zoom Out"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button> */}
        
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
        {createMode ? (
          <>
            <p className="font-bold text-red-600">🎯 Create Node Mode</p>
            <p>Click anywhere to place a node</p>
            <p>Coordinates shown in real-time</p>
          </>
        ) : (
          <>
            <p>🖱️ Scroll to zoom</p>
            <p>🤚 Click & drag to pan</p>
            <p>📍 Click nodes to select</p>
            <p>⚡ Shift+drag nodes to move</p>
          </>
        )}
      </div>
    </div>
  );
};

export default InteractiveMap;
