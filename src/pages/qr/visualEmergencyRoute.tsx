import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

const VisualEmergencyRoute: React.FC = () => {
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

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://alertup-backend.onrender.com';

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
            stroke="#FF0000"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.8"
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
                stroke="#CCCCCC"
                strokeWidth="1"
                strokeDasharray="3,3"
                opacity="0.5"
              />
            );
          }
        }
      });
    });
    
    return connections;
  }, [routeData, svgToScreenCoords]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <p className="ml-4 text-gray-600">Loading emergency route...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-md p-6 bg-white rounded-lg shadow-lg">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Back
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!routeData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-md p-6 bg-white rounded-lg shadow-lg">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Route Not Found</h2>
          <p className="text-gray-600">No route data found for QR code: {qrId}</p>
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Back
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl">🚨</span>
              <h1 className="ml-4 text-xl font-semibold text-gray-900">
                Emergency Route
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Back
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Home
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Display */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {routeData.buildingName} - Floor {routeData.floorNumber}
                </h2>
                <p className="text-sm text-gray-600">
                  Follow the red path to the nearest emergency exit
                </p>
              </div>

              {/* Map Container */}
              <div
                ref={containerRef}
                className="relative bg-gray-100 rounded-lg overflow-hidden border border-gray-300"
                style={{ width: '100%', height: '600px' }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Floor Map */}
                {routeData.floorMap?.svgContent ? (
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
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <span className="text-4xl">🗺️</span>
                      <p className="text-gray-600 mt-2">No floor map available</p>
                    </div>
                  </div>
                )}

                {/* Connections Layer */}
                <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '600px' }}>
                  {renderConnections()}
                </svg>

                {/* Emergency Route Layer */}
                <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '600px' }}>
                  {renderEmergencyRoute()}
                </svg>

                {/* Nodes Layer */}
                <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '600px' }}>
                  {routeData.allFloorNodes.map(node => {
                    const position = svgToScreenCoords(node.x, node.y);
                    const isStartNode = node.id === routeData.nodeId;
                    const isExitNode = node.id === routeData.emergencyRoute.exitNodeId;
                    const isPathNode = routeData.emergencyRoute.path.includes(node.id);
                    
                    return (
                      <g key={node.id}>
                        {/* Node circle */}
                        <circle
                          cx={position.x}
                          cy={position.y}
                          r={isStartNode ? 12 : isExitNode ? 10 : 6}
                          fill={
                            isStartNode ? '#FF0000' :
                            isExitNode ? '#00FF00' :
                            isPathNode ? '#FFA500' :
                            node.type === 'exit' ? '#00FF00' :
                            node.type === 'stairs' ? '#0000FF' : '#FFFF00'
                          }
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                        {/* Node icon */}
                        <text
                          x={position.x}
                          y={position.y + 4}
                          textAnchor="middle"
                          fontSize="12"
                          fill="#000000"
                        >
                          {getNodeIcon(node.type)}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Controls */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <button
                    onClick={() => setScale(prev => Math.min(prev * 1.2, 5))}
                    className="w-10 h-10 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center transition-colors shadow-md"
                    title="Zoom In"
                  >
                    <span className="text-lg">+</span>
                  </button>
                  
                  <button
                    onClick={() => setScale(prev => Math.max(prev * 0.8, 0.1))}
                    className="w-10 h-10 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center transition-colors shadow-md"
                    title="Zoom Out"
                  >
                    <span className="text-lg">−</span>
                  </button>
                  
                  <button
                    onClick={resetView}
                    className="w-10 h-10 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center transition-colors shadow-md"
                    title="Reset View"
                  >
                    <span className="text-lg">⟲</span>
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
                  <p>🔴 Follow red path to exit</p>
                </div>
              </div>
            </div>
          </div>

          {/* Route Information */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Route Information</h3>
              
              {routeData.emergencyRoute.found ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="text-green-600 font-medium">✅ Route to exit found</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Distance</p>
                    <p className="font-medium">{routeData.emergencyRoute.distance} steps</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Exit Location</p>
                    <p className="font-medium">
                      {routeData.emergencyRoute.exitNode?.label || 'Emergency Exit'}
                    </p>
                    <p className="text-sm text-gray-600">
                      ({routeData.emergencyRoute.exitNode?.x}, {routeData.emergencyRoute.exitNode?.y})
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Your Location</p>
                    <p className="font-medium">{routeData.nodeLabel}</p>
                    <p className="text-sm text-gray-600">
                      ({routeData.nodePosition.x}, {routeData.nodePosition.y})
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-red-600">
                  <p>❌ No exit route found</p>
                  <p className="text-sm text-gray-600 mt-2">
                    Please check with building staff for emergency instructions.
                  </p>
                </div>
              )}
            </div>

            {/* Emergency Instructions */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">🚨</span>
                <div>
                  <h3 className="text-lg font-bold text-red-800">Emergency Instructions</h3>
                  <p className="text-red-700">
                    Follow the highlighted route to the nearest emergency exit.
                  </p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-red-700">
                <p>• Stay calm and move quickly</p>
                <p>• Follow the red path on the map</p>
                <p>• Do not use elevators during fire</p>
                <p>• Help others if you can do so safely</p>
                <p>• Call emergency services if needed</p>
              </div>
            </div>

            {/* Building Info */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Building Details</h3>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Building</p>
                  <p className="font-medium">{routeData.buildingName}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Floor</p>
                  <p className="font-medium">Floor {routeData.floorNumber}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">QR Code ID</p>
                  <p className="font-medium text-xs">{qrId}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Last Updated</p>
                  <p className="font-medium text-xs">
                    {new Date(routeData.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualEmergencyRoute;
