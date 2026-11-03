import type { CollabPeer, PeerCursor } from './useEditorCollab';

/* ============================================================================
   Collab presentation — peer cursors on the map, avatars in the toolbar.
   ----------------------------------------------------------------------------
   Pure rendering; all state lives in useEditorCollab. Cursors draw in map
   coordinates inside the camera group (same rule as every other layer) and
   counter-scale so a peer's pointer stays pointer-sized at any zoom.
   ========================================================================= */

export interface PeerCursorsLayerProps {
  cursors: Map<string, PeerCursor>;
  /** Only cursors on this floor render — a pointer from another floor would
   *  hover over meaningless coordinates. */
  floorId: string | null;
  scale: number;
}

export const PeerCursorsLayer = ({ cursors, floorId, scale }: PeerCursorsLayerProps) => {
  const visible = [...cursors.values()].filter(
    (cursor) => cursor.floorId === floorId,
  );
  if (visible.length === 0) return null;

  const k = 1 / Math.max(scale, 0.4);

  return (
    <g data-testid="peer-cursors" style={{ pointerEvents: 'none' }}>
      {visible.map((cursor) => (
        <g
          key={cursor.socketId}
          transform={`translate(${cursor.x} ${cursor.y}) scale(${k})`}
          // The transform, not x/y attributes, so the browser can interpolate
          // the movement cheaply.
          style={{ transition: 'transform 80ms linear' }}
        >
          {/* Pointer arrowhead, tip at the exact cursor position. */}
          <path
            d="M 0 0 L 0 14 L 3.6 10.8 L 6.4 16.4 L 8.8 15.2 L 6 9.8 L 10.5 9 Z"
            fill={cursor.color}
            stroke="var(--surface)"
            strokeWidth={1}
          />
          {/* Name tag, offset past the arrow. */}
          <g transform="translate(12 16)">
            <rect
              x={0}
              y={0}
              rx={7}
              height={15}
              width={cursor.name.length * 6.2 + 10}
              fill={cursor.color}
            />
            <text
              x={5}
              y={10.5}
              fontSize={9.5}
              fontWeight={600}
              fill="#ffffff"
              style={{ userSelect: 'none' }}
            >
              {cursor.name}
            </text>
          </g>
        </g>
      ))}
    </g>
  );
};

export interface PresenceAvatarsProps {
  peers: CollabPeer[];
  /** Accessible label for the group, localized by the caller. */
  label: string;
}

/** Stacked initials of everyone else editing right now. */
export const PresenceAvatars = ({ peers, label }: PresenceAvatarsProps) => {
  if (peers.length === 0) return null;

  const shown = peers.slice(0, 5);
  const overflow = peers.length - shown.length;

  return (
    <div className="flex items-center" role="group" aria-label={label}>
      {shown.map((peer, index) => (
        <span
          key={peer.socketId}
          title={peer.name}
          style={{ backgroundColor: peer.color, zIndex: shown.length - index }}
          className={
            'grid h-7 w-7 place-items-center rounded-full border-2 border-surface ' +
            'text-[11px] font-bold text-white ' +
            (index > 0 ? '-ml-2' : '')
          }
        >
          {initials(peer.name)}
        </span>
      ))}
      {overflow > 0 && (
        <span className="-ml-2 grid h-7 w-7 place-items-center rounded-full border-2 border-surface bg-surface-2 text-[10px] font-semibold text-ink-muted">
          +{overflow}
        </span>
      )}
    </div>
  );
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
