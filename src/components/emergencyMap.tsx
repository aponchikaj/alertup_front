import React, { useEffect, useState, useMemo } from 'react';
import { getRoute, type RouteResponse, type RouteNode } from '../apis/routeService';

interface EmergencyMapProps {
  qrId: string | null | undefined;
}

const EmergencyMap: React.FC<EmergencyMapProps> = ({ qrId }) => {
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Validate qrId
  const isValidQRId = useMemo(() => {
    return typeof qrId === 'string' && qrId.length > 0 && qrId.length < 500;
  }, [qrId]);

  useEffect(() => {
    // Only fetch if we have a valid QR ID
    if (!isValidQRId) {
      setRouteData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const fetchRoute = async () => {
      try {
        setLoading(true);
        setError(null);
        setRouteData(null);

        const data = await getRoute(qrId);

        // Validate response
        if (!data.success || !data.route || !Array.isArray(data.route)) {
          throw new Error('Invalid response format from server');
        }

        if (data.route.length === 0) {
          throw new Error('Route is empty');
        }

        // Validate route nodes
        for (const node of data.route) {
          if (
            typeof node.x !== 'number' ||
            typeof node.y !== 'number' ||
            typeof node.type !== 'string'
          ) {
            throw new Error('Invalid node data in route');
          }
        }

        // Validate SVG dimensions
        if (!data.svgDimensions || data.svgDimensions.width <= 0 || data.svgDimensions.height <= 0) {
          throw new Error('Invalid SVG dimensions');
        }

        // Validate start point
        if (
          !data.startPoint ||
          typeof data.startPoint.x !== 'number' ||
          typeof data.startPoint.y !== 'number'
        ) {
          throw new Error('Invalid start point');
        }

        setRouteData(data);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load route data';
        setError(errorMessage);
        setRouteData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRoute();
  }, [isValidQRId, qrId]);

  // Loading state
  if (loading) {
    return (
      <div className="emergency-map-container loading">
        <div className="spinner" />
        <p>Loading emergency exit route...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="emergency-map-container error">
        <div className="error-icon">⚠️</div>
        <h2>Navigation Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  // No QR ID provided
  if (!isValidQRId) {
    return (
      <div className="emergency-map-container error">
        <div className="error-icon">📱</div>
        <h2>Scan QR Code</h2>
        <p>Please scan a QR code to view the emergency exit route</p>
      </div>
    );
  }

  // No route data
  if (!routeData) {
    return (
      <div className="emergency-map-container error">
        <div className="error-icon">❌</div>
        <p>No route data available</p>
      </div>
    );
  }

  const { route, startPoint, svgContent, svgDimensions } = routeData;

  // Validate route is not empty
  if (!route || route.length === 0) {
    return (
      <div className="emergency-map-container error">
        <p>Route is empty</p>
      </div>
    );
  }

  // Generate polyline points from route
  const polylinePoints = route
    .filter((point) => typeof point.x === 'number' && typeof point.y === 'number')
    .map((point: RouteNode) => `${point.x},${point.y}`)
    .join(' ');

  // Validate polyline points
  if (!polylinePoints) {
    return (
      <div className="emergency-map-container error">
        <p>Invalid route coordinates</p>
      </div>
    );
  }

  return (
    <div className="emergency-map-wrapper">
      <div className="emergency-map-header">
        <h1>Emergency Exit Route</h1>
        {routeData.building && (
          <p className="building-info">Building: {routeData.building}</p>
        )}
        <p className="floor-info">Floor: {routeData.floor}</p>
      </div>

      <div className="emergency-map-container">
        <svg
          viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
          className="floor-map"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Render SVG content if available */}
          {svgContent && (
            <g
              dangerouslySetInnerHTML={{ __html: svgContent }}
              className="svg-floor-content"
            />
          )}

          {/* Background if no SVG content */}
          {!svgContent && (
            <rect
              width={svgDimensions.width}
              height={svgDimensions.height}
              fill="#f5f5f5"
              stroke="#ddd"
              strokeWidth="2"
            />
          )}

          {/* Route polyline */}
          {route.length > 1 && (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#ff0000"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="route-path"
            />
          )}

          {/* Start point marker */}
          <circle
            cx={startPoint.x}
            cy={startPoint.y}
            r="8"
            fill="#00cc00"
            stroke="#fff"
            strokeWidth="2"
            className="start-point"
          >
            <title>Start Location</title>
          </circle>

          {/* Route nodes */}
          {route.map((point: RouteNode, index: number) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r="6"
                fill={
                  point.type === 'exit'
                    ? '#ff0000'
                    : point.type === 'stairs'
                      ? '#ffaa00'
                      : '#0066ff'
                }
                stroke="#fff"
                strokeWidth="1.5"
                className={`route-node ${point.type}`}
              >
                <title>{point.label || point.type}</title>
              </circle>
            </g>
          ))}

          {/* Exit point highlight */}
          {route.length > 0 && route[route.length - 1].type === 'exit' && (
            <circle
              cx={route[route.length - 1].x}
              cy={route[route.length - 1].y}
              r="12"
              fill="none"
              stroke="#ff0000"
              strokeWidth="2"
              strokeDasharray="4"
              className="exit-pulse"
            />
          )}
        </svg>
      </div>

      <div className="route-legend">
        <div className="legend-item">
          <div className="legend-marker" style={{ backgroundColor: '#00cc00' }} />
          <span>Your Location</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker" style={{ backgroundColor: '#ff0000' }} />
          <span>Exit</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker" style={{ backgroundColor: '#ffaa00' }} />
          <span>Stairs</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker" style={{ backgroundColor: '#0066ff' }} />
          <span>Path</span>
        </div>
        <div className="legend-item">
          <div
            className="legend-marker"
            style={{ background: 'linear-gradient(to right, #ff0000, transparent)' }}
          />
          <span>Route</span>
        </div>
      </div>

      <div className="route-info">
        <p>
          <strong>Distance:</strong> Follow the red line to the nearest exit
        </p>
        <p>
          <strong>Route Nodes:</strong> {route.length}
        </p>
      </div>
    </div>
  );
};

export default EmergencyMap;
