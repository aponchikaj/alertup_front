import { renderHook } from "@testing-library/react";
import { headingFromEvent, useDeviceHeading } from "./useDeviceHeading";

/* ============================================================================
   useDeviceHeading — the compass behind "Facing 90°".
   ----------------------------------------------------------------------------
   jsdom has no DeviceOrientationEvent, which is exactly the desktop case: the
   hook must report `unsupported` and the stepper must then never offer a
   permission prompt that cannot be answered.
   ========================================================================= */

describe("useDeviceHeading", () => {
  test("reports unsupported when the browser has no orientation events", () => {
    expect("DeviceOrientationEvent" in window).toBe(false);

    const { result } = renderHook(() => useDeviceHeading());

    expect(result.current.state).toBe("unsupported");
    expect(result.current.heading).toBeNull();
  });

  test("prefers webkitCompassHeading and otherwise converts alpha to a heading", () => {
    // iOS gives a true compass bearing directly.
    expect(headingFromEvent({ alpha: 10, webkitCompassHeading: 42 })).toBe(42);
    // Everyone else reports alpha counter-clockwise from north.
    expect(headingFromEvent({ alpha: 90 })).toBe(270);
    expect(headingFromEvent({ alpha: 0 })).toBe(0);
    expect(headingFromEvent({ alpha: 359 })).toBe(1);
    // Nothing usable at all.
    expect(headingFromEvent({ alpha: null })).toBeNull();
  });
});
