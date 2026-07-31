import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createBuildingChannel } from "../lib/realtime";
import {
  emergencyReducer,
  initialEmergencyState,
  readAck,
  writeAck,
  type EmergencyPhase,
} from "./emergencyMachine";
import type { BuildingEvent, ChannelStatus, EmergencySnapshot } from "./types";

/* ============================================================================
   EmergencyProvider — building-scoped, never global.
   ----------------------------------------------------------------------------
   Mounted only by pages that have a building context (the scan route page,
   building admin pages), so a visitor reading the marketing site never opens a
   realtime connection. The reducer owns the phase; this component owns the
   transport and the sessionStorage acknowledgement.
   ========================================================================= */

export interface EmergencyContextValue {
  phase: EmergencyPhase;
  emergencyId: string | null;
  message: string | null;
  startedAt: string | null;
  /** Live activity feed — only populated when `feed` is enabled. */
  logs: Array<{ id: string; message: string; type: string; createdAt: string }>;
  counters: EmergencySnapshot["counters"];
  connection: ChannelStatus;
  /** The user chose "I'm safe" — acknowledges THIS emergency only. */
  bypass: () => void;
  dismissResolvedNotice: () => void;
}

export const EmergencyContext = createContext<EmergencyContextValue | null>(null);

export interface EmergencyProviderProps {
  buildingId: string | null;
  /** Subscribe to the member feed (live logs + counters) instead of the public stream. */
  feed?: boolean;
  /** Seed from a page payload (e.g. the scan response) so the overlay paints on first render. */
  initialSnapshot?: Partial<EmergencySnapshot> | null;
  children: ReactNode;
}

const MAX_LOGS = 200;

export const EmergencyProvider = ({
  buildingId,
  feed = false,
  initialSnapshot = null,
  children,
}: EmergencyProviderProps) => {
  const [state, dispatch] = useReducer(
    emergencyReducer,
    buildingId ? readAck(buildingId) : null,
    initialEmergencyState,
  );
  const [logs, setLogs] = useState<EmergencyContextValue["logs"]>([]);
  const [counters, setCounters] = useState<EmergencySnapshot["counters"]>(null);
  const [connection, setConnection] = useState<ChannelStatus>("connecting");

  // Seed from the page payload so an active emergency is on screen before the
  // stream connects — during a fire, a round-trip of latency is not free.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !initialSnapshot) return;
    seededRef.current = true;
    dispatch({
      type: "SNAPSHOT",
      isEmergency: Boolean(initialSnapshot.isEmergency),
      emergencyId: initialSnapshot.emergencyId ?? null,
      message: initialSnapshot.message ?? null,
      startedAt: initialSnapshot.startedAt ?? null,
    });
  }, [initialSnapshot]);

  useEffect(() => {
    if (!buildingId) return;

    const channel = createBuildingChannel(buildingId, { feed });
    setConnection(channel.status());

    const unsubscribeStatus = channel.onStatusChange(setConnection);
    const unsubscribe = channel.subscribe((event: BuildingEvent) => {
      switch (event.type) {
        case "state":
          dispatch({
            type: "SNAPSHOT",
            isEmergency: event.data.isEmergency,
            emergencyId: event.data.emergencyId,
            message: event.data.message,
            startedAt: event.data.startedAt,
          });
          setCounters(event.data.counters ?? null);
          break;
        case "emergency_started":
          dispatch({
            type: "EMERGENCY_STARTED",
            emergencyId: event.data.emergencyId,
            message: event.data.message,
            startedAt: event.data.startedAt,
          });
          break;
        case "emergency_ended":
          dispatch({ type: "EMERGENCY_ENDED" });
          setLogs([]);
          setCounters(null);
          break;
        case "log_appended":
          setLogs((current) => {
            const entry = {
              id: event.data.id ?? `${event.data.createdAt}-${current.length}`,
              message: event.data.message,
              type: event.data.type,
              createdAt: event.data.createdAt,
            };
            const next = [...current, entry];
            return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
          });
          break;
        case "counters_updated":
          setCounters(event.data);
          break;
      }
    });

    return () => {
      unsubscribe();
      unsubscribeStatus();
      channel.close();
    };
  }, [buildingId, feed]);

  const bypass = useCallback(() => {
    if (buildingId && state.emergencyId) writeAck(buildingId, state.emergencyId);
    dispatch({ type: "BYPASS" });
  }, [buildingId, state.emergencyId]);

  const dismissResolvedNotice = useCallback(() => {
    if (buildingId) writeAck(buildingId, null);
    dispatch({ type: "NOTICE_DISMISSED" });
  }, [buildingId]);

  const value = useMemo<EmergencyContextValue>(
    () => ({
      phase: state.phase,
      emergencyId: state.emergencyId,
      message: state.message,
      startedAt: state.startedAt,
      logs,
      counters,
      connection,
      bypass,
      dismissResolvedNotice,
    }),
    [state, logs, counters, connection, bypass, dismissResolvedNotice],
  );

  return (
    <EmergencyContext.Provider value={value}>{children}</EmergencyContext.Provider>
  );
};

export default EmergencyProvider;
