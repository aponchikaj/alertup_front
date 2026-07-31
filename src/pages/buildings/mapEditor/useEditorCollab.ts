import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '../../../apis/http';
import type { FloorDrawing } from '../../../components/map';
import type {
  EditorEdge,
  EditorFloor,
  EditorNode,
  EditorPoi,
} from '../../../apis/mapEditorApi';

/* ============================================================================
   useEditorCollab — the editor's live channel.
   ----------------------------------------------------------------------------
   Wraps one socket per building: presence (who else is in this editor),
   cursors (where their pointer is, in map coordinates), and ops ("I changed
   X", carrying the row the server returned).

   The socket is never the source of truth. Every mutation still goes through
   REST first; only after the server accepts it does the row get relayed, so a
   peer that misses an op is merely stale, never corrupted — and a full page
   refresh always reconverges on the database.
   ========================================================================= */

export interface CollabPeer {
  socketId: string;
  userId: string;
  name: string;
  color: string;
}

export interface PeerCursor extends CollabPeer {
  x: number;
  y: number;
  floorId: string | null;
  tool: string | null;
  /** Local receipt time, for pruning cursors whose owner went quiet. */
  at: number;
}

/** "I changed X" — the row the server returned, relayed to the room. */
export type EditorOp =
  | { kind: 'node:upsert'; node: EditorNode }
  | { kind: 'node:delete'; nodeId: string }
  | { kind: 'edge:upsert'; edge: EditorEdge }
  | { kind: 'edge:delete'; edgeId: string }
  | { kind: 'poi:upsert'; poi: EditorPoi }
  | { kind: 'poi:delete'; nodeId: string }
  | { kind: 'floor:upsert'; floor: EditorFloor }
  | { kind: 'floor:delete'; floorId: string }
  | { kind: 'drawing'; floorId: string; drawing: FloorDrawing };

/** Cursor frames per second cap. Above ~25 the extra frames buy nothing. */
const CURSOR_MIN_INTERVAL_MS = 40;

/** A cursor that has not moved in this long belongs to someone who left the
 *  map (or closed the tab mid-frame — volatile events carry no goodbye). */
const CURSOR_STALE_MS = 5_000;

export interface UseEditorCollabOptions {
  buildingId: string;
  /** Off until the graph has loaded — joining earlier shows peers a cursor
   *  over a map the local user cannot see yet. */
  enabled: boolean;
  onRemoteOp: (op: EditorOp) => void;
}

export interface UseEditorCollabResult {
  /** Everyone in the room, self excluded. Empty while offline. */
  peers: CollabPeer[];
  self: CollabPeer | null;
  /** Live peer cursors keyed by socket id. */
  cursors: Map<string, PeerCursor>;
  connected: boolean;
  sendCursor: (x: number, y: number, floorId: string | null, tool: string) => void;
  sendOp: (op: EditorOp) => void;
}

export const useEditorCollab = ({
  buildingId,
  enabled,
  onRemoteOp,
}: UseEditorCollabOptions): UseEditorCollabResult => {
  const [peers, setPeers] = useState<CollabPeer[]>([]);
  const [self, setSelf] = useState<CollabPeer | null>(null);
  const [cursors, setCursors] = useState<Map<string, PeerCursor>>(new Map());
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const selfIdRef = useRef<string | null>(null);
  const lastCursorSentRef = useRef(0);

  // The op handler closes over live page state; a ref keeps this effect's
  // socket subscription from tearing down on every graph change.
  const onRemoteOpRef = useRef(onRemoteOp);
  useEffect(() => {
    onRemoteOpRef.current = onRemoteOp;
  }, [onRemoteOp]);

  useEffect(() => {
    if (!enabled || !buildingId) return;

    const socket = io(API_BASE_URL, {
      withCredentials: true,
      // Cookie is the primary credential; the token mirrors http.ts's
      // Safari/iOS localStorage fallback.
      auth: { token: localStorage.getItem('userToken') || undefined },
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;

    const joinRoom = () => {
      socket.emit(
        'editor:join',
        { buildingId },
        (reply: { ok: boolean; self?: CollabPeer; peers?: CollabPeer[] } | undefined) => {
          if (!reply?.ok || !reply.self) return;
          selfIdRef.current = reply.self.socketId;
          setSelf(reply.self);
          setPeers(
            (reply.peers ?? []).filter((p) => p.socketId !== reply.self?.socketId),
          );
          setConnected(true);
        },
      );
    };

    // 'connect' fires on the first connection AND on every reconnect, so the
    // room is automatically re-joined after a network blip or deploy.
    socket.on('connect', joinRoom);

    socket.on('disconnect', () => {
      setConnected(false);
      setPeers([]);
      setCursors(new Map());
    });

    socket.on('editor:presence', ({ peers: roster }: { peers: CollabPeer[] }) => {
      const selfId = selfIdRef.current;
      setPeers(roster.filter((p) => p.socketId !== selfId));
      // Drop cursors of anyone no longer present.
      setCursors((current) => {
        const alive = new Set(roster.map((p) => p.socketId));
        const next = new Map(
          [...current].filter(([socketId]) => alive.has(socketId)),
        );
        return next.size === current.size ? current : next;
      });
    });

    socket.on('editor:cursor', (cursor: Omit<PeerCursor, 'at'>) => {
      if (cursor.socketId === selfIdRef.current) return;
      setCursors((current) => {
        const next = new Map(current);
        next.set(cursor.socketId, { ...cursor, at: Date.now() });
        return next;
      });
    });

    socket.on('editor:op', ({ op }: { op: EditorOp }) => {
      if (op && typeof op === 'object') onRemoteOpRef.current(op);
    });

    // Volatile frames carry no goodbye, so quiet cursors age out on a timer.
    const pruneTimer = setInterval(() => {
      setCursors((current) => {
        const cutoff = Date.now() - CURSOR_STALE_MS;
        const next = new Map([...current].filter(([, c]) => c.at >= cutoff));
        return next.size === current.size ? current : next;
      });
    }, 2_000);

    return () => {
      clearInterval(pruneTimer);
      socket.emit('editor:leave');
      socket.close();
      socketRef.current = null;
      selfIdRef.current = null;
      setConnected(false);
      setSelf(null);
      setPeers([]);
      setCursors(new Map());
    };
  }, [buildingId, enabled]);

  const sendCursor = useCallback(
    (x: number, y: number, floorId: string | null, tool: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) return;
      const now = Date.now();
      if (now - lastCursorSentRef.current < CURSOR_MIN_INTERVAL_MS) return;
      lastCursorSentRef.current = now;
      // Volatile on the sending side too: a queued backlog of stale positions
      // is worse than a dropped frame.
      socket.volatile.emit('editor:cursor', { x, y, floorId, tool });
    },
    [],
  );

  const sendOp = useCallback((op: EditorOp) => {
    socketRef.current?.emit('editor:op', { op });
  }, []);

  return { peers, self, cursors, connected, sendCursor, sendOp };
};

export default useEditorCollab;
