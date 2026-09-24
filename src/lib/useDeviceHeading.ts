import { useCallback, useEffect, useRef, useState } from "react";

/* ============================================================================
   useDeviceHeading — which way the visitor is facing.
   ----------------------------------------------------------------------------
   The heading goes to the server, which uses it to phrase the first
   instruction as a turn ("turn right out of the lift") instead of a compass
   bearing nobody can act on. No bearing maths happens here: the client reports
   degrees, the routing engine decides what they mean.

   Two constraints shape the API:

   - iOS only grants orientation from a real user gesture, and only for a
     `requestPermission()` call made synchronously inside it. So `request()` is
     a separate function the tap handler calls; the hook never asks on mount.
   - A compass fires tens of times a second. Nothing on screen changes that
     fast and every update would be a React render, so readings are throttled
     to 1 Hz.
   ========================================================================= */

export type DeviceHeadingState = "unsupported" | "idle" | "granted" | "denied";

export interface DeviceHeading {
  /** Degrees clockwise from north (0–359), or null until a reading lands. */
  heading: number | null;
  state: DeviceHeadingState;
  /** Call from inside a tap handler — iOS rejects it from anywhere else. */
  request: () => void;
}

/** At most one reading per second; a compass fires far faster than this. */
const MIN_INTERVAL_MS = 1000;

/** Safari's non-standard true-north reading, absent everywhere else. */
interface CompassEvent {
  alpha?: number | null;
  webkitCompassHeading?: number | null;
}

/** The constructor doubles as the permission gate on iOS. */
type OrientationCtor = {
  requestPermission?: () => Promise<PermissionState | "default">;
};

const orientationCtor = (): OrientationCtor | null => {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as Record<string, unknown>)
    .DeviceOrientationEvent;
  return typeof ctor === "function" ? (ctor as unknown as OrientationCtor) : null;
};

const normalise = (deg: number): number => ((deg % 360) + 360) % 360;

/**
 * Pure: a compass bearing from one orientation event.
 *
 * `webkitCompassHeading` is already degrees clockwise from true north. `alpha`
 * is the opposite convention — counter-clockwise from north — so it is
 * subtracted from 360 rather than used directly.
 */
export const headingFromEvent = (event: CompassEvent): number | null => {
  const webkit = event.webkitCompassHeading;
  if (typeof webkit === "number" && Number.isFinite(webkit)) {
    return Math.round(normalise(webkit));
  }
  const { alpha } = event;
  if (typeof alpha !== "number" || !Number.isFinite(alpha)) return null;
  return Math.round(normalise(360 - alpha));
};

export function useDeviceHeading(): DeviceHeading {
  const [state, setState] = useState<DeviceHeadingState>(() =>
    orientationCtor() ? "idle" : "unsupported",
  );
  const [heading, setHeading] = useState<number | null>(null);
  const lastReadAtRef = useRef(0);

  useEffect(() => {
    if (state !== "granted") return;

    const onOrientation = (event: Event) => {
      const now = Date.now();
      if (now - lastReadAtRef.current < MIN_INTERVAL_MS) return;
      const next = headingFromEvent(event as unknown as CompassEvent);
      if (next === null) return;
      lastReadAtRef.current = now;
      setHeading((current) => (current === next ? current : next));
    };

    // `deviceorientationabsolute` is the one that is actually north-referenced;
    // `deviceorientation` is relative on Chrome/Android and absolute on iOS,
    // which is why iOS also supplies webkitCompassHeading.
    const type =
      "ondeviceorientationabsolute" in window
        ? "deviceorientationabsolute"
        : "deviceorientation";
    window.addEventListener(type, onOrientation);
    return () => window.removeEventListener(type, onOrientation);
  }, [state]);

  const request = useCallback(() => {
    const ctor = orientationCtor();
    if (!ctor) {
      setState("unsupported");
      return;
    }
    // Must be reached synchronously from the tap: iOS drops the prompt
    // otherwise. Only the *result* is awaited.
    if (typeof ctor.requestPermission === "function") {
      ctor.requestPermission().then(
        (result) => setState(result === "granted" ? "granted" : "denied"),
        () => setState("denied"),
      );
      return;
    }
    // No permission gate (Android, older Safari): listening is the grant.
    setState("granted");
  }, []);

  return { heading, state, request };
}

export default useDeviceHeading;
