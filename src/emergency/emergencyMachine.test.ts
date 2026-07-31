import {
  emergencyReducer,
  initialEmergencyState,
  type EmergencyState,
} from "./emergencyMachine";

const snapshot = (
  overrides: Partial<{
    isEmergency: boolean;
    emergencyId: string | null;
    message: string | null;
    startedAt: string | null;
  }> = {}
) => ({
  type: "SNAPSHOT" as const,
  isEmergency: false,
  emergencyId: null,
  message: null,
  startedAt: null,
  ...overrides,
});

describe("emergencyMachine", () => {
  test("unknown -> normal on quiet snapshot", () => {
    const s = emergencyReducer(initialEmergencyState(), snapshot());
    expect(s.phase).toBe("normal");
  });

  test("unknown -> emergency on active snapshot", () => {
    const s = emergencyReducer(
      initialEmergencyState(),
      snapshot({ isEmergency: true, emergencyId: "e1", message: "Fire", startedAt: "t" })
    );
    expect(s.phase).toBe("emergency");
    expect(s.message).toBe("Fire");
  });

  test("unknown -> bypassed when the active emergency was already acked (reload)", () => {
    const s = emergencyReducer(
      initialEmergencyState("e1"),
      snapshot({ isEmergency: true, emergencyId: "e1", message: "Fire", startedAt: "t" })
    );
    expect(s.phase).toBe("bypassed");
  });

  test("bypass acks the current emergency; same emergency never re-nags", () => {
    let s: EmergencyState = emergencyReducer(
      initialEmergencyState(),
      snapshot({ isEmergency: true, emergencyId: "e1", startedAt: "t" })
    );
    s = emergencyReducer(s, { type: "BYPASS" });
    expect(s.phase).toBe("bypassed");
    expect(s.ackedEmergencyId).toBe("e1");

    // Re-broadcast of the SAME emergency stays bypassed
    s = emergencyReducer(s, {
      type: "EMERGENCY_STARTED",
      emergencyId: "e1",
      message: null,
      startedAt: "t",
    });
    expect(s.phase).toBe("bypassed");

    // A NEW emergency re-triggers the overlay
    s = emergencyReducer(s, {
      type: "EMERGENCY_STARTED",
      emergencyId: "e2",
      message: "Gas leak",
      startedAt: "t2",
    });
    expect(s.phase).toBe("emergency");
    expect(s.emergencyId).toBe("e2");
  });

  test("bypass is a no-op outside the emergency phase", () => {
    const s = emergencyReducer(
      emergencyReducer(initialEmergencyState(), snapshot()),
      { type: "BYPASS" }
    );
    expect(s.phase).toBe("normal");
    expect(s.ackedEmergencyId).toBeNull();
  });

  test("resolution shows the notice, clears ack, then dismisses to normal", () => {
    let s: EmergencyState = emergencyReducer(
      initialEmergencyState(),
      snapshot({ isEmergency: true, emergencyId: "e1", startedAt: "t" })
    );
    s = emergencyReducer(s, { type: "BYPASS" });
    s = emergencyReducer(s, { type: "EMERGENCY_ENDED" });
    expect(s.phase).toBe("resolvedNotice");
    expect(s.ackedEmergencyId).toBeNull();

    s = emergencyReducer(s, { type: "NOTICE_DISMISSED" });
    expect(s.phase).toBe("normal");
  });

  test("quiet snapshot during emergency also resolves (poll fallback path)", () => {
    let s: EmergencyState = emergencyReducer(
      initialEmergencyState(),
      snapshot({ isEmergency: true, emergencyId: "e1", startedAt: "t" })
    );
    s = emergencyReducer(s, snapshot({ isEmergency: false }));
    expect(s.phase).toBe("resolvedNotice");
  });
});
