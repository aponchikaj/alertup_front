import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/pageHeader';
import axios from 'axios';

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
  connectedNodes: any[];
  allFloorNodes: FloorNode[];
  emergencyRoute: EmergencyRoute;
  floorMap: FloorMap | null;
  timestamp: string;
  scanCount: number;
}

const QRScanRoutePage: React.FC = () => {
  const { qrId } = useParams<{ qrId: string }>();
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<FloorNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<FloorNode | null>(null);
  const [mapImageError, setMapImageError] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    document.title = 'Emergency Route - AlertUp';
    
    if (qrId) {
      fetchRouteData(qrId);
    }
  }, [qrId]);

  const fetchRouteData = async (qrId: string) => {
    try {
      setLoading(true);
      setError(null);
      setMapImageError(false);
      
      const response = await axios.get(`${API_BASE_URL}/api/qr/scan/route/${qrId}`);
      
      if (response.data.success) {
        setRouteData(response.data.data);
        console.log('✅ Route data loaded:', response.data.data);
      } else {
        setError(response.data.message || 'Failed to load route data');
      }
    } catch (err: any) {
      console.error('Error fetching route data:', err);
      setError(err.message || 'Failed to load route data');
    } finally {
      setLoading(false);
    }
  };

  // Handle zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.1), 5);
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const scaleChange = newScale - scale;
    const newTranslateX = translateX - (mouseX - 400) * scaleChange;
    const newTranslateY = translateY - (mouseY - 300) * scaleChange;
    
    setScale(newScale);
    setTranslateX(newTranslateX);
    setTranslateY(newTranslateY);
  }, [scale, translateX, translateY]);

  // Handle pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - translateX, y: e.clientY - translateY });
    }
  }, [translateX, translateY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const newTranslateX = e.clientX - dragStart.x;
      const newTranslateY = e.clientY - dragStart.y;
      setTranslateX(newTranslateX);
      setTranslateY(newTranslateY);
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, []);

  // Convert SVG coordinates to screen coordinates
  const svgToScreenCoords = useCallback((svgX: number, svgY: number) => {
    const baseX = (svgX / 1000) * 800;
    const baseY = (svgY / 800) * 600;
    const transformedX = baseX * scale + translateX;
    const transformedY = baseY * scale + translateY;
    return { x: transformedX, y: transformedY };
  }, [scale, translateX, translateY]);

  // Get node icon
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'exit':
        return '🟢';
      case 'stairs':
        return '🔵';
      default:
        return '🟡';
    }
  };

  // Get node color
  const getNodeColor = (node: FloorNode, routeData: RouteData) => {
    const isStartNode = node.id === routeData.nodeId;
    const isExitNode = node.id === routeData.emergencyRoute.exitNodeId;
    
    if (isStartNode) return '#FF0000';
    if (isExitNode) return '#00FF00';
    if (node.type === 'exit') return '#00FF00';
    if (node.type === 'stairs') return '#0000FF';
    return '#FFFF00';
  };

  // Render the emergency route path
  const renderEmergencyRoute = useCallback(() => {
    if (!routeData || !routeData.emergencyRoute.found) return null;

    const path = routeData.emergencyRoute.path;
    const pathElements: JSX.Element[] = [];

    for (let i = 0; i < path.length - 1; i++) {
      const currentNode = routeData.allFloorNodes.find(n => n.id === path[i]);
      const nextNode = routeData.allFloorNodes.find(n => n.id === path[i + 1]);
      
      if (currentNode && nextNode) {
        const fromPos = svgToScreenCoords(currentNode.x, currentNode.y);
        const toPos = svgToScreenCoords(nextNode.x, nextNode.y);
        
        pathElements.push(
          <line
            key={`path-${i}`}
            x1={fromPos.x}
            y1={fromPos.y}
            x2={toPos.x}
            y2={toPos.y}
            stroke="#FF7B22"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.9"
          />
        );
      }
    }

    return pathElements;
  }, [routeData, svgToScreenCoords]);

  // Render all connections
  const renderConnections = useCallback(() => {
    if (!routeData) return null;

    const connections: JSX.Element[] = [];
    
    routeData.allFloorNodes.forEach(node => {
      node.connections.forEach(connectedNodeId => {
        const connectedNode = routeData.allFloorNodes.find(n => n.id === connectedNodeId);
        if (connectedNode) {
          const fromPos = svgToScreenCoords(node.x, node.y);
          const toPos = svgToScreenCoords(connectedNode.x, connectedNode.y);
          
          // Only render each connection once
          const connectionId = [node.id, connectedNodeId].sort().join('-');
          if (!connections.find(c => c.key === connectionId)) {
            connections.push(
              <line
                key={connectionId}
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke="#666666"
                strokeWidth="1"
                strokeDasharray="3,3"
                opacity="0.4"
              />
            );
          }
        }
      });
    });
    
    return connections;
  }, [routeData, svgToScreenCoords]);

  // Handle node click
  const handleNodeClick = (node: FloorNode) => {
    setSelectedNode(node);
  };

  // Navigation helpers
  const handleGoBack = () => navigate(-1);
  const handleGoHome = () => navigate('/');

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
            >
              Back
            </button>
            <button
              onClick={handleGoHome}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
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
            >
              Back
            </button>
            <button
              onClick={handleGoHome}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
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
                  {/* Floor Map */}
                  {routeData.floorMap?.imageUrl && !mapImageError ? (
                    <img
                      src={routeData.floorMap.imageUrl}
                      alt={`Floor ${routeData.floorNumber} Map`}
                      className="absolute inset-0 w-full h-full object-contain"
                      style={{
                        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                        transformOrigin: 'center',
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                      }}
                      onError={() => setMapImageError(true)}
                    />
                  ) : routeData.floorMap?.svgContent ? (
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
                      dangerouslySetInnerHTML={{ __html: routeData.floorMap.svgContent }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                      <div className="text-center">
                        <span className="text-4xl">🗺️</span>
                        <p className="text-gray-400 mt-2">No floor map available</p>
                        <p className="text-sm text-gray-500 mt-1">Showing node layout only</p>
                      </div>
                    </div>
                  )}

                  {/* Connections Layer */}
                  <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '500px' }}>
                    {renderConnections()}
                  </svg>

                  {/* Emergency Route Layer */}
                  <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '500px' }}>
                    {renderEmergencyRoute()}
                  </svg>

                  {/* Nodes Layer */}
                  <svg className="absolute inset-0" style={{ width: '100%', height: '500px' }}>
                    {routeData.allFloorNodes.map(node => {
                      const position = svgToScreenCoords(node.x, node.y);
                      const nodeColor = getNodeColor(node, routeData);
                      const isStartNode = node.id === routeData.nodeId;
                      const isExitNode = node.id === routeData.emergencyRoute.exitNodeId;
                      const radius = isStartNode ? 12 : isExitNode ? 10 : 6;
                      
                      return (
                        <g key={node.id}>
                          {/* Node circle */}
                          <circle
                            cx={position.x}
                            cy={position.y}
                            r={radius}
                            fill={nodeColor}
                            stroke="#FFFFFF"
                            strokeWidth="2"
                            className="cursor-pointer transition-all hover:stroke-4"
                            onMouseEnter={() => setHoveredNode(node)}
                            onMouseLeave={() => setHoveredNode(null)}
                            onClick={() => handleNodeClick(node)}
                          />
                          {/* Node icon */}
                          <text
                            x={position.x}
                            y={position.y + 4}
                            textAnchor="middle"
                            fontSize="12"
                            fill="#000000"
                            pointerEvents="none"
                          >
                            {getNodeIcon(node.type)}
                          </text>
                          {/* Node label on hover */}
                          {hoveredNode?.id === node.id && (
                            <g>
                              <rect
                                x={position.x - 40}
                                y={position.y - 35}
                                width="80"
                                height="25"
                                fill="white"
                                stroke="#333"
                                strokeWidth="1"
                                rx="4"
                              />
                              <text
                                x={position.x}
                                y={position.y - 18}
                                textAnchor="middle"
                                fontSize="11"
                                fill="#333"
                                fontWeight="bold"
                              >
                                {node.label}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  {/* Controls */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2">
                    <button
                      onClick={() => setScale(prev => Math.min(prev * 1.2, 5))}
                      className="w-10 h-10 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors"
                      title="Zoom In"
                    >
                      <span className="text-lg">+</span>
                    </button>
                    
                    <button
                      onClick={() => setScale(prev => Math.max(prev * 0.8, 0.1))}
                      className="w-10 h-10 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors"
                      title="Zoom Out"
                    >
                      <span className="text-lg">−</span>
                    </button>
                    
                    <button
                      onClick={resetView}
                      className="w-10 h-10 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors"
                      title="Reset View"
                    >
                      <span className="text-lg">⟲</span>
                    </button>
                  </div>

                  {/* Zoom Indicator */}
                  <div className="absolute bottom-4 right-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white px-3 py-1 rounded-lg text-sm">
                    {Math.round(scale * 100)}%
                  </div>

                  {/* Instructions */}
                  <div className="absolute bottom-4 left-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white px-3 py-2 rounded-lg text-xs max-w-xs">
                    <p>🖱️ Scroll to zoom</p>
                    <p>🤚 Click & drag to pan</p>
                    <p>🟠 Follow orange path to exit</p>
                  </div>
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
                  
                  <div>
                    <p className="text-sm text-gray-400">QR Code ID</p>
                    <p className="font-medium text-xs text-gray-300">{qrId}</p>
                  </div>
                  
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
                >
                  ← Back
                </button>
                <button
                  onClick={handleGoHome}
                  className="w-full px-4 py-3 bg-[#FF7B22] text-white font-semibold rounded-lg hover:bg-[#FF7B22]/80 transition-colors"
                >
                  Home
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

export default QRScanRoutePage;
