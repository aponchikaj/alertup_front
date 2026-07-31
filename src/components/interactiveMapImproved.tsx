import { useState, useRef, useEffect, useCallback, useMemo, type JSX } from 'react';
import { type Node } from '../apis/nodesApi';
import { sanitizeSvg } from '../lib/sanitizeSvg';
import { buttonStyles } from './ui/styles';
import {
  MapIcon,
  MapPinIcon,
  RefreshIcon,
  RouteIcon,
  SearchIcon,
  ZapIcon,
} from './ui/icons';

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
  // ReturnType<typeof setTimeout> rather than NodeJS.Timeout: this is browser
  // code and @types/node is not in this project's `types` list.
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The map's own coordinate space. Node x/y are stored in these units.
  const SVG_WIDTH = 1000;
  const SVG_HEIGHT = 800;

  // The container is sized by CSS (w-full h-full), so its real pixel size is
  // measured rather than assumed from the width/height props. Those props
  // default to 800x600 and almost never matched the rendered element, which is
  // what pushed every node marker and click away from the floor plan beneath.
  const [containerSize, setContainerSize] = useState({ width, height });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      // Only commit a genuine change: ResizeObserver fires on layout passes
      // that often report identical dimensions, and re-setting the same object
      // would re-render the whole map (and every node overlay) for nothing.
      setContainerSize((current) =>
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height },
      );
    };

    measure();

    // ResizeObserver is the accurate signal (the container is resized by layout
    // changes, not just by window resizes), but it is absent in jsdom and in
    // older browsers, so fall back to a window resize listener rather than
    // throwing during mount.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Cancel any pending debounced node update on unmount. Without this, tearing
  // the map down within 100ms of a drag (a floor switch, a route change) still
  // fired onNodeUpdate, triggering an API call and a setState on a component
  // that no longer exists.
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, []);

  // Reset view when the displayed map changes.
  // floorMapUrl is included because image-based floors have no svgContent, so
  // switching between them used to keep the previous floor's pan offset.
  useEffect(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, [svgContent, floorMapUrl]);

  /**
   * The background SVG uses preserveAspectRatio="xMidYMid meet", which scales
   * uniformly and centres the result, leaving letterbox bars on one axis. The
   * overlay math has to reproduce exactly that: a single scale factor plus the
   * centring offset. Using independent scaleX/scaleY (and no offset) skewed the
   * overlay relative to the map on any container that was not exactly 5:4.
   */
  const viewport = useMemo(() => {
    const fit = Math.min(containerSize.width / SVG_WIDTH, containerSize.height / SVG_HEIGHT);
    return {
      fit,
      offsetX: (containerSize.width - SVG_WIDTH * fit) / 2,
      offsetY: (containerSize.height - SVG_HEIGHT * fit) / 2,
    };
  }, [containerSize.width, containerSize.height]);

  // Convert screen coordinates to SVG coordinates
  const screenToSvgCoords = useCallback((screenX: number, screenY: number) => {
    // Undo pan/zoom, then the letterbox offset, then the uniform fit scale.
    const containerX = (screenX - translateX) / scale;
    const containerY = (screenY - translateY) / scale;

    const svgX = (containerX - viewport.offsetX) / viewport.fit;
    const svgY = (containerY - viewport.offsetY) / viewport.fit;

    return {
      x: Math.round(Math.max(0, Math.min(SVG_WIDTH, svgX))),
      y: Math.round(Math.max(0, Math.min(SVG_HEIGHT, svgY)))
    };
  }, [scale, translateX, translateY, viewport]);

  // Convert SVG coordinates to screen coordinates
  const svgToScreenCoords = useCallback((svgX: number, svgY: number) => {
    const containerX = svgX * viewport.fit + viewport.offsetX;
    const containerY = svgY * viewport.fit + viewport.offsetY;

    return {
      x: containerX * scale + translateX,
      y: containerY * scale + translateY
    };
  }, [scale, translateX, translateY, viewport]);

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
    } else if (createMode) {
      // Deliberately does nothing: the click bubbles to the container, whose
      // onClick creates the node. Creating one here as well produced two nodes
      // at nearly identical coordinates whenever the user clicked on or near an
      // existing node in create mode — stopPropagation on mousedown does not
      // suppress the click event that follows.
    } else {
      // Regular node click
      onNodeClick(node._id);
    }
  }, [onNodeClick, onNodeUpdate, createMode]);

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
                stroke="var(--brand)"
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
    <div className="relative bg-surface-2 rounded-2xl overflow-hidden border border-line w-full h-full">
      {/* Map Container */}
      <div
        ref={containerRef}
        className={`relative w-full h-full ${createMode ? 'cursor-crosshair' : 'cursor-move'}`}
        // The onWheel handler was removed: React attaches wheel listeners
        // passively, so its preventDefault() never took effect — it only logged
        // a console error on every tick while the page scrolled anyway. Zoom is
        // disabled, so there is nothing for it to do.
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
              transformOrigin: '0 0',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
            // Uploaded floor-plan markup, sanitized before injection.
            dangerouslySetInnerHTML={{ __html: sanitizeSvg(svgContent) }}
          />
        ) : floorMapUrl ? (
          <div className="absolute inset-0 w-full h-full">
            <img
              src={floorMapUrl}
              alt="Floor Map"
              className="w-full h-full object-contain"
              style={{
                transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                transformOrigin: '0 0',
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
          <div className="absolute inset-0 flex items-center justify-center bg-canvas-subtle">
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-subtle text-brand-text">
                <MapIcon size={24} />
              </span>
              <p className="font-medium text-ink">No map available for this floor</p>
              <p className="text-sm text-ink-muted">Upload an SVG or convert an image to get started</p>
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
                node.type === 'exit' ? 'bg-success' :
                node.type === 'stairs' ? 'bg-info' : 'bg-warning'
              } ${
                isSelected ? 'ring-4 ring-brand/60 scale-150 z-20' : ''
              } ${
                isHovered ? 'ring-2 ring-brand/40 scale-125 z-10' : ''
              } ${
                draggedNode === node._id ? 'cursor-grabbing ring-4 ring-info scale-125 z-30' : ''
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
            className="absolute w-6 h-6 border-2 border-danger rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${mousePosition.x}px`,
              top: `${mousePosition.y}px`,
            }}
          />
        )}

        {/* Coordinate Display */}
        <div className="absolute top-4 left-4 rounded-lg border border-line bg-surface/90 px-2 py-1 text-xs text-ink-muted shadow-sm backdrop-blur-sm pointer-events-none">
          <div>Mouse: ({Math.round(mousePosition.x)}, {Math.round(mousePosition.y)})</div>
          <div>SVG: ({svgCoordinates.x}, {svgCoordinates.y})</div>
          <div>Zoom: {Math.round(scale * 100)}%</div>
          {createMode && (
            <div className="text-brand-text font-semibold mt-1">
              Click to place node at ({svgCoordinates.x}, {svgCoordinates.y})
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={resetView}
          className={buttonStyles({ variant: "secondary", size: "icon-sm" })}
          title="Reset View"
          aria-label="Reset view"
        >
          <RefreshIcon size={18} />
        </button>
      </div>

      {/* Zoom Indicator */}
      <div className="absolute bottom-4 right-4 rounded-lg border border-line bg-surface px-3 py-1 text-sm text-ink-muted shadow-sm">
        {Math.round(scale * 100)}%
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 flex max-w-xs flex-col gap-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-muted shadow-sm">
        {createMode ? (
          <>
            <p className="flex items-center gap-1.5 font-semibold text-danger-text">
              <MapPinIcon size={13} className="shrink-0" />
              Create Node Mode
            </p>
            <p>Click anywhere to place a node</p>
            <p>Coordinates shown in real-time</p>
          </>
        ) : (
          <>
            <p className="flex items-center gap-1.5">
              <SearchIcon size={13} className="shrink-0 text-ink-subtle" />
              Scroll to zoom
            </p>
            <p className="flex items-center gap-1.5">
              <RouteIcon size={13} className="shrink-0 text-ink-subtle" />
              Click &amp; drag to pan
            </p>
            <p className="flex items-center gap-1.5">
              <MapPinIcon size={13} className="shrink-0 text-ink-subtle" />
              Click nodes to select
            </p>
            <p className="flex items-center gap-1.5">
              <ZapIcon size={13} className="shrink-0 text-ink-subtle" />
              Shift+drag nodes to move
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default InteractiveMap;
