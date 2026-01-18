import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

interface RouteData {
  qrId: string;
  buildingId: string;
  buildingName: string;
  floorNumber: number;
  nodeId: string;
  nodeType: 'path' | 'exit' | 'stairs';
  nodeLabel: string;
  nodePosition: { x: number; y: number };
  connectedNodes: Array<{
    id: string;
    x: number;
    y: number;
    type: 'path' | 'exit' | 'stairs';
    label: string;
  }>;
  allFloorNodes: Array<{
    id: string;
    x: number;
    y: number;
    type: 'path' | 'exit' | 'stairs';
    label: string;
  }>;
  timestamp: string;
  scanCount: number;
}

const QRCodeScanPage: React.FC = () => {
  const { qrId } = useParams<{ qrId: string }>();
  const navigate = useNavigate();
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://alertup-backend.onrender.com';

  useEffect(() => {
    const fetchRouteData = async () => {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        console.error('Error fetching route data:', err);
        setError(err.message || 'Failed to load route data');
      } finally {
        setLoading(false);
      }
    };

    fetchRouteData();
  }, [qrId, API_BASE_URL]);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'exit':
        return '🟢'; // Green for exit
      case 'stairs':
        return '🔵'; // Blue for stairs
      default:
        return '🟡'; // Yellow for path
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <p className="ml-4 text-gray-600">Loading route data...</p>
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
              onClick={handleGoBack}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Go Back
            </button>
            <button
              onClick={handleGoHome}
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
              onClick={handleGoBack}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Go Back
            </button>
            <button
              onClick={handleGoHome}
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
              <span className="text-2xl">🧭</span>
              <h1 className="ml-4 text-xl font-semibold text-gray-900">
                Emergency Route
              </h1>
            </div>
            <div className="flex items-center space-x-4">
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
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Route Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🗺️</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Emergency Route</h2>
              <p className="text-gray-600">QR Code ID: {qrId}</p>
            </div>
          </div>

          {/* Building and Floor Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Building</h3>
              <p className="text-lg font-semibold text-gray-900">{routeData.buildingName}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Floor</h3>
              <p className="text-lg font-semibold text-gray-900">Floor {routeData.floorNumber}</p>
            </div>
          </div>

          {/* Node Info */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Node Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Node Type</p>
                <div className="flex items-center">
                  <span className="text-xl mr-2">{getNodeIcon(routeData.nodeType)}</span>
                  <span className="font-medium text-gray-900">{routeData.nodeType}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Node Label</p>
                <p className="font-medium text-gray-900">{routeData.nodeLabel}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Position</p>
              <p className="font-medium text-gray-900">({routeData.nodePosition.x}, {routeData.nodePosition.y})</p>
            </div>
          </div>

          {/* Connected Nodes */}
          {routeData.connectedNodes.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                Connected Nodes ({routeData.connectedNodes.length})
              </h3>
              <div className="space-y-2">
                {routeData.connectedNodes.map((connectedNode) => (
                  <div key={connectedNode.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                    <span className="text-xl">{getNodeIcon(connectedNode.type)}</span>
                    <div>
                      <p className="font-medium text-gray-900">{connectedNode.label}</p>
                      <p className="text-sm text-gray-600">({connectedNode.x}, {connectedNode.y})</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Floor Nodes */}
          {routeData.allFloorNodes.length > 1 && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                All Floor Nodes ({routeData.allFloorNodes.length})
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {routeData.allFloorNodes.map((node) => (
                  <div key={node.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                    <span className="text-lg">{getNodeIcon(node.type)}</span>
                    <div>
                      <p className="font-medium text-gray-900">{node.label}</p>
                      <p className="text-sm text-gray-600">({node.x}, {node.y})</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamp and Scan Count */}
          <div className="border-t pt-4">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Scanned: {routeData.scanCount} times</span>
              <span>{new Date(routeData.timestamp).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Emergency Instructions */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <h3 className="text-lg font-bold text-yellow-800">Emergency Instructions</h3>
              <p className="text-yellow-700">
                Follow the highlighted route to the nearest emergency exit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeScanPage;
