import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapCanvas } from './MapCanvas';
import { NodeLayer } from './layers/NodeLayer';
import { EdgeLayer } from './layers/EdgeLayer';
import { RouteLayer } from './layers/RouteLayer';
import { UserDotLayer } from './layers/UserDotLayer';
import { PoiLayer } from './layers/PoiLayer';
import type { MapEdge, MapNode, Poi, RouteSegment } from './types';

const nodes: MapNode[] = [
  { id: 'a', x: 100, y: 100, type: 'ENTRANCE', label: 'Main door' },
  { id: 'b', x: 300, y: 100, type: 'NORMAL', label: null },
  { id: 'x', x: 500, y: 100, type: 'EMERGENCY_EXIT', label: 'Exit A' },
  { id: 'p', x: 300, y: 300, type: 'POI', label: 'LC Waikiki' },
];
const nodesById = new Map(nodes.map((n) => [n.id, n]));

const edges: MapEdge[] = [
  { id: 'e1', sourceNodeId: 'a', targetNodeId: 'b', transitType: 'WALKWAY', accessible: true },
  { id: 'e2', sourceNodeId: 'b', targetNodeId: 'x', transitType: 'STAIRS', accessible: false },
];

const segment: RouteSegment = {
  index: 0,
  floor: null,
  nodes: [
    { id: 'a', x: 100, y: 100, type: 'ENTRANCE', label: null },
    { id: 'b', x: 300, y: 100, type: 'NORMAL', label: null },
    { id: 'x', x: 500, y: 100, type: 'EMERGENCY_EXIT', label: null },
  ],
  distancePx: 400,
  distanceMeters: 40,
};

const pois: Poi[] = [
  { id: 'poi1', nodeId: 'p', name: 'LC Waikiki', category: 'Apparel', keywords: [] },
];

describe('MapCanvas', () => {
  test('renders a viewBox sized to the floor space', () => {
    const { container } = render(
      <MapCanvas space={{ width: 1200, height: 900 }} ariaLabel="Floor map" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 1200 900');
    expect(screen.getByLabelText('Floor map')).toBeInTheDocument();
  });

  test('applies the camera transform to the layer group', () => {
    const { container } = render(
      <MapCanvas camera={{ scale: 2, tx: 40, ty: -10 }}>
        <NodeLayer nodes={nodes} />
      </MapCanvas>,
    );
    const group = container.querySelector('svg > g') as SVGGElement;
    expect(group.style.transform).toBe('translate(40px, -10px) scale(2)');
  });

  test('does not crash when a click lands with no CTM (jsdom)', async () => {
    const onMapClick = jest.fn();
    const { container } = render(<MapCanvas onMapClick={onMapClick} />);
    await userEvent.click(container.querySelector('svg') as SVGSVGElement);
    // getScreenCTM is unavailable in jsdom, so the handler no-ops rather than
    // reporting a wrong coordinate.
    expect(onMapClick).not.toHaveBeenCalled();
  });
});

describe('layers', () => {
  test('NodeLayer renders one marker per node and fires clicks', async () => {
    const onNodeClick = jest.fn();
    const { container } = render(
      <MapCanvas>
        <NodeLayer nodes={nodes} onNodeClick={onNodeClick} scale={1} />
      </MapCanvas>,
    );

    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(4);
    await userEvent.click(container.querySelector('[data-node-id="a"]') as Element);
    expect(onNodeClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  test('NodeLayer hides labels below the zoom threshold', () => {
    const { container, rerender } = render(
      <MapCanvas>
        <NodeLayer nodes={nodes} scale={1} labelMinScale={0.75} />
      </MapCanvas>,
    );
    expect(container.querySelectorAll('text').length).toBeGreaterThan(0);

    rerender(
      <MapCanvas>
        <NodeLayer nodes={nodes} scale={0.4} labelMinScale={0.75} />
      </MapCanvas>,
    );
    expect(container.querySelectorAll('text')).toHaveLength(0);
  });

  test('EdgeLayer draws a line per edge and skips dangling references', () => {
    const withDangling: MapEdge[] = [
      ...edges,
      {
        id: 'ghost',
        sourceNodeId: 'a',
        targetNodeId: 'deleted',
        transitType: 'WALKWAY',
        accessible: true,
      },
    ];
    const { container } = render(
      <MapCanvas>
        <EdgeLayer edges={withDangling} nodesById={nodesById} />
      </MapCanvas>,
    );
    expect(container.querySelectorAll('line')).toHaveLength(2);
  });

  test('EdgeLayer marks inaccessible edges with a tooltip', () => {
    const { container } = render(
      <MapCanvas>
        <EdgeLayer edges={edges} nodesById={nodesById} inaccessibleLabel="No step-free access" />
      </MapCanvas>,
    );
    expect(container.querySelector('title')?.textContent).toBe('No step-free access');
  });

  test('RouteLayer draws the segment path and nothing for an empty route', () => {
    const { container, rerender } = render(
      <MapCanvas>
        <RouteLayer segment={segment} tone="danger" />
      </MapCanvas>,
    );
    const drawn = container.querySelector('.route-path-draw');
    expect(drawn).toHaveAttribute('d', 'M 100 100 L 300 100 L 500 100');

    rerender(
      <MapCanvas>
        <RouteLayer segment={null} />
      </MapCanvas>,
    );
    expect(container.querySelector('[data-testid="route-layer"]')).toBeNull();
  });

  test('UserDotLayer renders only when a position is known', () => {
    const { container, rerender } = render(
      <MapCanvas>
        <UserDotLayer position={{ x: 10, y: 20 }} label="You are here" />
      </MapCanvas>,
    );
    expect(container.querySelector('[data-testid="user-dot-layer"]')).toBeInTheDocument();

    rerender(
      <MapCanvas>
        <UserDotLayer position={null} />
      </MapCanvas>,
    );
    expect(container.querySelector('[data-testid="user-dot-layer"]')).toBeNull();
  });

  test('PoiLayer pins POIs and declutters names when zoomed out', async () => {
    const onPoiClick = jest.fn();
    const { container, rerender } = render(
      <MapCanvas>
        <PoiLayer pois={pois} nodesById={nodesById} scale={1.5} onPoiClick={onPoiClick} />
      </MapCanvas>,
    );
    expect(screen.getByText('LC Waikiki')).toBeInTheDocument();

    await userEvent.click(container.querySelector('[data-poi-id="poi1"]') as Element);
    expect(onPoiClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'poi1' }),
      expect.objectContaining({ id: 'p' }),
    );

    rerender(
      <MapCanvas>
        <PoiLayer pois={pois} nodesById={nodesById} scale={0.5} />
      </MapCanvas>,
    );
    expect(screen.queryByText('LC Waikiki')).not.toBeInTheDocument();
  });

  test('PoiLayer skips a POI whose node was deleted', () => {
    const orphan: Poi[] = [
      { id: 'poi2', nodeId: 'gone', name: 'Ghost shop', category: null, keywords: [] },
    ];
    const { container } = render(
      <MapCanvas>
        <PoiLayer pois={orphan} nodesById={nodesById} scale={2} />
      </MapCanvas>,
    );
    expect(container.querySelector('[data-poi-id="poi2"]')).toBeNull();
  });
});
