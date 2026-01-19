import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/pageHeader';
import axios from 'axios';
import { evacuatedFunc } from '../../apis/building';

interface FloorNode {
  id: string;
  x: number;
  y: number;
  type: 'path' | 'exit' | 'stairs';
  label: string;
  connections: string[];
}

interface EmergencyRoute {
  found: boolean;
  exitNodeId: string | null;
  path: string[];
  distance: number;
  exitNode: FloorNode | null;
}

interface FloorMap {
  floor: string;
  map: string;
  svgContent?: string;
  imageUrl?: string;
}

interface RouteData {
  qrId: string;
  buildingId: string;
  buildingName: string;
  floorNumber: number;
  nodeId: string;
  nodeType: 'path' | 'exit' | 'stairs';
  nodeLabel: string;
  nodePosition: { x: number; y: number };
  connectedNodes: FloorNode[];
  allFloorNodes: FloorNode[];
  emergencyRoute: EmergencyRoute;
  floorMap: FloorMap | null;
  timestamp: string;
  scanCount: number;
}

const QRScanRoutePageFixed: React.FC = () => {
  const { qrId } = useParams<{ qrId: string }>();
  // const navigate = useNavigate();
  
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<FloorNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  
  // Map interaction state
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Fixed dimensions for uploaded images
  const mapDimensions = { width: 1000, height: 800 };

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://alertup-backend.onrender.com';

  const fetchRouteData = useCallback(async (qrId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_BASE_URL}/api/qr/scan/route/${qrId}`);
      
      if (response.data.success) {
        // The QR scan endpoint already returns the correct format
        setRouteData(response.data.data);
        console.log('✅ Route data loaded:', response.data.data);
      } else {
        setError(response.data.message || 'Failed to load route data');
      }
    } catch (err: unknown) {
      console.error('Error fetching route data:', err);
      
      if (err && typeof err === 'object' && 'response' in err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const axiosError = err as any;
        if (axiosError.response?.status === 404) {
          setError('QR code not found. Please scan a valid emergency QR code.');
        } else if (axiosError.response?.status === 400) {
          setError('Invalid QR code format.');
        } else {
          setError(axiosError.response?.data?.message || 'Failed to load route data');
        }
      } else {
        const error = err as Error;
        setError(error.message || 'Failed to load route data');
      }
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    document.title = 'Emergency Route - AlertUp';
    
    if (qrId) {
      fetchRouteData(qrId);
    }
  }, [qrId, fetchRouteData]);

  // Handle node selection
  const handleNodeClick = useCallback((node: FloorNode) => {
    setSelectedNode(node.id === selectedNode?.id ? null : node);
  }, [selectedNode]);

  // Handle node hover
  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNode(nodeId);
  }, []);

  // Pan and zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.5), 3);
    setScale(newScale);
  }, [scale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - translateX, y: e.clientY - translateY });
  }, [translateX, translateY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setTranslateX(e.clientX - dragStart.x);
    setTranslateY(e.clientY - dragStart.y);
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleGoBack = () => {
    window.history.back();
  };

  const handleEvacuated = async() => {
    const res = await evacuatedFunc(routeData?.buildingId)
    if(!res || res.Success==false) window.location.href = '/'
    window.location.href = '/';
  };

  const handleGoHome = ()=>{
    window.location.href = '/'
  }

  if (loading) {
    return (
      <main className="w-full h-screen p-2 flex flex-col bg-[#353535]">
        <section className="h-[10vh] w-full" />
        <section className="h-auto w-full flex items-center justify-center">
          <PageHeader title="Loading Route" backIcon={true} />
        </section>
        <main className="w-full h-[70vh] md:h-full flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF7B22] mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading emergency route...</p>
        </main>
      </main>
    );
  }

  if (error) {
    return (
      <main className="w-full h-screen p-2 flex flex-col bg-[#353535]">
        <section className="h-[10vh] w-full" />
        <section className="h-auto w-full flex items-center justify-center">
          <PageHeader title="Error" backIcon={true} />
        </section>
        <main className="w-full h-[70vh] md:h-full flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Error</h2>
          <p className="text-gray-300">{error}</p>
          <div className="flex gap-4 mt-4">
            <button
              onClick={handleGoBack}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              aria-label="Go back to previous page"
            >
              Back
            </button>
            <button
              onClick={handleGoHome}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              aria-label="Go to home page"
            >
              Home
            </button>
          </div>
        </main>
      </main>
    );
  }

  if (!routeData) {
    return (
      <main className="w-full h-screen p-2 flex flex-col bg-[#353535]">
        <section className="h-[10vh] w-full" />
        <section className="h-auto w-full flex items-center justify-center">
          <PageHeader title="Route Not Found" backIcon={true} />
        </section>
        <main className="w-full h-[70vh] md:h-full flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Route Not Found</h2>
          <p className="text-gray-300">No route data found for QR code: {qrId}</p>
          <div className="flex gap-4 mt-4">
            <button
              onClick={handleGoBack}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              aria-label="Go back to previous page"
            >
              Back
            </button>
            <button
              onClick={handleGoHome}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              aria-label="Go to home page"
            >
              Home
            </button>
          </div>
        </main>
      </main>
    );
  }

  return (
    <main className="w-full h-screen p-2 flex flex-col bg-[#353535]">
      {/* Spacer for header */}
      <section className="h-[10vh] w-full" />

      {/* Page Header */}
      <section className="h-auto w-full flex items-center justify-center">
        <PageHeader title="Emergency Route" backIcon={true} />
      </section>

      {/* Main Content */}
      <main className="w-full h-[70vh] md:h-full flex-1 overflow-y-auto px-4 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Building Info Card */}
          <div className="mb-6 p-6 bg-white/5 rounded-lg border border-white/10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#FF7B22] mb-2">
                  {routeData.buildingName}
                </h2>
                <p className="text-gray-300">
                  Floor {routeData.floorNumber} • Scanned {routeData.scanCount} times
                </p>
              </div>
              <div className="mt-4 md:mt-0 flex items-center gap-2">
                <span className="text-2xl">🚨</span>
                <span className="text-lg font-semibold text-white">Emergency Exit Route</span>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Main Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map Display */}
            <div className="lg:col-span-2">
              <div className="p-6 bg-white/5 rounded-lg border border-white/10">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-white mb-2">
                    Emergency Route Map
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Follow the orange path to the nearest emergency exit
                  </p>
                </div>

                {/* Map Container */}
                <div
                  ref={containerRef}
                  className="relative bg-gray-900 rounded-lg overflow-hidden border border-white/20"
                  style={{ width: '100%', height: '500px' }}
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {/* Combined SVG Layer - Map + Overlays */}
                  <svg
                    className="absolute inset-0"
                    style={{ 
                      width: '100%', 
                      height: '500px',
                      cursor: isDragging ? 'grabbing' : 'grab'
                    }}
                    viewBox={`0 0 ${mapDimensions.width} ${mapDimensions.height}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <g
                      style={{
                        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                        transformOrigin: 'center',
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                      }}
                    >
                    {/* Floor Map Background */}
                    {routeData.floorMap?.imageUrl ? (
                      <image
                        href={routeData.floorMap.imageUrl}
                        x="0"
                        y="0"
                        width={mapDimensions.width}
                        height={mapDimensions.height}
                        preserveAspectRatio="xMidYMid meet"
                        onError={() => {
                          console.log('❌ Failed to load image:', routeData.floorMap?.imageUrl);
                        }}
                        onLoad={() => {
                          console.log('✅ Image loaded successfully:', routeData.floorMap?.imageUrl);
                        }}
                      />
                    ) : routeData.floorMap?.svgContent ? (
                      <g
                        dangerouslySetInnerHTML={{ __html: routeData.floorMap.svgContent }}
                      />
                    ) : (
                      <g>
                        {/* Dark background */}
                        <rect
                          x="0"
                          y="0"
                          width={mapDimensions.width}
                          height={mapDimensions.height}
                          fill="#1a1a1a"
                        />
                        {/* Grid pattern for better visualization */}
                        <defs>
                          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#333" strokeWidth="1"/>
                          </pattern>
                        </defs>
                        <rect
                          x="0"
                          y="0"
                          width={mapDimensions.width}
                          height={mapDimensions.height}
                          fill="url(#grid)"
                        />
                        {/* Center text */}
                        <text
                          x={mapDimensions.width / 2}
                          y={mapDimensions.height / 2}
                          textAnchor="middle"
                          fill="#666"
                          fontSize="24"
                        >
                          🗺️
                        </text>
                        <text
                          x={mapDimensions.width / 2}
                          y={mapDimensions.height / 2 + 30}
                          textAnchor="middle"
                          fill="#999"
                          fontSize="16"
                        >
                          No Floor Map Available
                        </text>
                        <text
                          x={mapDimensions.width / 2}
                          y={mapDimensions.height / 2 + 30}
                          textAnchor="middle"
                          fill="#999"
                          fontSize="16"
                        >
                          No Floor Map Available
                        </text>
                      </g>
                    )}

                    {/* Emergency Route Path */}
                    {routeData.emergencyRoute.found && routeData.emergencyRoute.path.length > 0 && (() => {
                      const pathNodes = routeData.emergencyRoute.path
                        .map(nodeId => routeData.allFloorNodes.find(n => n.id === nodeId))
                        .filter(Boolean) as FloorNode[];
                      
                      if (pathNodes.length < 2) return null;
                      
                      const pathData = pathNodes
                        .map((node, index) => `${index === 0 ? 'M' : 'L'} ${node.x} ${node.y}`)
                        .join(' ');
                      
                      return (
                        <path
                          d={pathData}
                          stroke="#FF7B22"
                          strokeWidth="4"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={0.8}
                        />
                      );
                    })()}

                    {/* Nodes Layer */}
                    {routeData.allFloorNodes.map((node) => {
                      const isCurrentNode = node.id === routeData.nodeId;
                      const isExitNode = node.id === routeData.emergencyRoute.exitNodeId;
                      const isPathNode = routeData.emergencyRoute.path.includes(node.id);
                      const isSelected = selectedNode?.id === node.id;
                      const isHovered = hoveredNode === node.id;
                      
                      return (
                        <g key={node.id}>
                          {/* Node circle */}
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={isSelected ? 30 : isHovered ? 25 :20}
                            fill={
                              isCurrentNode ? '#EF4444' : // red for current
                              isExitNode ? '#10B981' : // green for exit
                              isPathNode ? '#F59E0B' : // orange for path
                              node.type === 'exit' ? '#10B981' :
                              node.type === 'stairs' ? '#3B82F6' :
                              '#6B7280' // gray for regular
                            }
                            stroke={isSelected ? '#FFFFFF' : 'transparent'}
                            strokeWidth={isSelected ? 2 : 0}
                            opacity={isPathNode ? 1 : 0.7}
                            className="cursor-pointer transition-all"
                            onClick={() => handleNodeClick(node)}
                            onMouseEnter={() => handleNodeHover(node.id)}
                            onMouseLeave={() => handleNodeHover(null)}
                          />
                          
                          {/* Node label */}
                          <text
                            x={node.x}
                            y={node.y - 12}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="12"
                            className="pointer-events-none select-none"
                          >
                            {node.label}
                          </text>
                        </g>
                      );
                    })}
                    </g>
                  </svg>
                </div>
              </div>
            </div>

            {/* Route Information Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Route Status Card */}
              <div className="p-6 bg-white/5 rounded-lg border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4">Route Information</h3>
                
                {routeData.emergencyRoute.found ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <p className="text-green-400 font-medium">✅ Route to exit found</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-400">Distance</p>
                      <p className="font-medium text-white">{routeData.emergencyRoute.distance} steps</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-400">Exit Location</p>
                      <p className="font-medium text-white">
                        {routeData.emergencyRoute.exitNode?.label || 'Emergency Exit'}
                      </p>
                      <p className="text-sm text-gray-400">
                        ({routeData.emergencyRoute.exitNode?.x}, {routeData.emergencyRoute.exitNode?.y})
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-400">Your Location</p>
                      <p className="font-medium text-white">{routeData.nodeLabel}</p>
                      <p className="text-sm text-gray-400">
                        ({routeData.nodePosition.x}, {routeData.nodePosition.y})
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-red-400">
                    <p>❌ No exit route found</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Please check with building staff for emergency instructions.
                    </p>
                  </div>
                )}
              </div>

              {/* Selected Node Information */}
              {selectedNode && (
                <div className="p-6 bg-white/5 rounded-lg border border-white/10">
                  <h3 className="text-lg font-bold text-white mb-4">Node Details</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-400">Label</p>
                      <p className="font-medium text-white">{selectedNode.label}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Type</p>
                      <p className="font-medium text-white capitalize">{selectedNode.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Position</p>
                      <p className="font-medium text-white">({selectedNode.x}, {selectedNode.y})</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Connections</p>
                      <p className="font-medium text-white">{selectedNode.connections.length} nodes</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="mt-4 w-full px-4 py-2 bg-gray-500/20 border border-gray-500 text-gray-300 rounded-lg hover:bg-gray-500/30 transition-colors"
                    aria-label="Clear selected node"
                  >
                    Clear selection
                  </button>
                </div>
              )}

              {/* Emergency Instructions Card */}
              <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-center mb-4">
                  <span className="text-2xl mr-3">🚨</span>
                  <div>
                    <h3 className="text-lg font-bold text-red-400">Emergency Instructions</h3>
                    <p className="text-red-300 text-sm">
                      Follow the highlighted route to the nearest emergency exit.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm text-red-300">
                  <p>• Stay calm and move quickly</p>
                  <p>• Follow the orange path on the map</p>
                  <p>• Do not use elevators during fire</p>
                  <p>• Help others if you can do so safely</p>
                  <p>• Call emergency services if needed</p>
                </div>
              </div>

              {/* Building Details Card */}
              <div className="p-6 bg-white/5 rounded-lg border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4">Building Details</h3>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">Building</p>
                    <p className="font-medium text-white">{routeData.buildingName}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-400">Floor</p>
                    <p className="font-medium text-white">Floor {routeData.floorNumber}</p>
                  </div>
                  
                  {/* <div>
                    <p className="text-sm text-gray-400">QR Code ID</p>
                    <p className="font-medium text-xs text-gray-300">{qrId}</p>
                  </div> */}
                  
                  <div>
                    <p className="text-sm text-gray-400">Last Updated</p>
                    <p className="font-medium text-xs text-gray-300">
                      {new Date(routeData.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleGoBack}
                  className="w-full px-4 py-3 bg-gray-500/20 border border-gray-500 text-gray-300 rounded-lg hover:bg-gray-500/30 transition-colors"
                  aria-label="Go back to previous page"
                >
                  ← Back
                </button>
                <button
                  onClick={handleEvacuated}
                  className="w-full px-4 py-3 bg-[#FF7B22] text-white font-semibold rounded-lg hover:bg-[#FF7B22]/80 transition-colors"
                  aria-label="Go to home page"
                >
                  Evacuated
                </button>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-8 p-4 bg-white/5 rounded-lg border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4">Node Types</h3>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-gray-300">Your Location</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-300">Emergency Exit</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-gray-300">Stairs/Elevator</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-gray-300">Path Point</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-[#FF7B22]"></div>
                <span className="text-gray-300">Emergency Route</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </main>
  );
};

export default QRScanRoutePageFixed;
