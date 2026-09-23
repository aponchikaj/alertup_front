import { buttonStyles, inputStyles, badgeStyles, cardStyles } from "./styles";

describe("buttonStyles", () => {
  it("defaults to the brand-filled primary", () => {
    expect(buttonStyles()).toContain("bg-brand");
    expect(buttonStyles()).toContain("text-brand-ink");
  });

  it("uses a 10px radius, not a pill — this is equipment, not marketing", () => {
    expect(buttonStyles()).toContain("rounded-md");
    expect(buttonStyles()).not.toContain("rounded-full");
  });

  it("exposes an emergency variant, always full width and taller than the rest", () => {
    const emergency = buttonStyles({ variant: "emergency", size: "xl" });
    expect(emergency).toContain("bg-danger");
    expect(emergency).toContain("text-danger-ink");
    expect(emergency).toContain("h-14");
    // A half-width evacuate button is a bug, not a layout choice.
    expect(emergency).toContain("w-full");
  });

  it("puts the default size on the 44px platform touch target", () => {
    expect(buttonStyles({ size: "md" })).toContain("min-h-11");
    expect(buttonStyles({ size: "icon" })).toContain("min-h-11");
  });

  it("keeps even the compact size past the WCAG 2.2 floor", () => {
    // sm is h-9 = 36px. That clears SC 2.5.8 (24x24 CSS px) comfortably; it
    // sits under Apple's 44px guidance, which is why it is `sm` and not the
    // default. Anything smaller than h-6 would be a real violation.
    expect(buttonStyles({ size: "sm" })).toContain("min-h-9");
  });

  it("uses the UI weight, not the heading weight", () => {
    expect(buttonStyles()).toContain("font-medium");
  });
});

describe("inputStyles", () => {
  it("borders with line-control, which clears 3:1 — plain line does not", () => {
    expect(inputStyles()).toContain("border-line-control");
  });

  it("marks invalid with the danger border", () => {
    expect(inputStyles({ invalid: true })).toContain("border-danger");
  });

  it("never drops below 16px — smaller makes iOS zoom the viewport on focus", () => {
    expect(inputStyles()).toContain("text-base");
  });

  it("matches the control radius", () => {
    expect(inputStyles()).toContain("rounded-md");
  });
});

describe("badgeStyles", () => {
  it("renders each tone against its own subtle ground", () => {
    expect(badgeStyles({ tone: "danger" })).toContain("bg-danger-subtle");
    expect(badgeStyles({ tone: "success" })).toContain("bg-success-subtle");
    expect(badgeStyles({ tone: "brand" })).toContain("bg-brand-subtle");
  });

  it("stays a pill — a badge is a label, not a control", () => {
    expect(badgeStyles()).toContain("rounded-full");
  });
});

describe("cardStyles", () => {
  it("uses the card radius, one step up from controls", () => {
    expect(cardStyles()).toContain("rounded-lg");
    expect(cardStyles()).not.toContain("rounded-2xl");
  });
});
