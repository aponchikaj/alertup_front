import {
  buttonStyles,
  inputStyles,
  searchFieldStyles,
  chipStyles,
  badgeStyles,
  cardStyles,
} from "./styles";

describe("buttonStyles", () => {
  it("defaults to the accent-filled primary", () => {
    expect(buttonStyles()).toContain("bg-accent");
    expect(buttonStyles()).toContain("text-accent-ink");
  });

  it("makes primary a pill, so it reads as the thing to press", () => {
    expect(buttonStyles({ variant: "primary" })).toContain("rounded-pill");
  });

  it("gives form and table controls the tighter radius — a row of pills is confetti", () => {
    expect(buttonStyles({ variant: "secondary" })).toContain("rounded-md");
    expect(buttonStyles({ variant: "ghost" })).toContain("rounded-md");
    expect(buttonStyles({ variant: "destructive" })).toContain("rounded-md");
  });

  it("can force the tighter radius on a pill variant", () => {
    expect(buttonStyles({ variant: "primary", square: true })).toContain("rounded-md");
  });

  it("sizes at 36 / 44 / 52, with 44 the default touch target", () => {
    expect(buttonStyles({ size: "sm" })).toContain("h-9");
    expect(buttonStyles({ size: "md" })).toContain("h-11");
    expect(buttonStyles({ size: "lg" })).toContain("h-13");
    expect(buttonStyles()).toContain("h-11");
  });

  it("uses amber for emergency, never red", () => {
    const em = buttonStyles({ variant: "emergency" });
    expect(em).toContain("bg-alarm");
    expect(em).toContain("text-alarm-ink");
    expect(em).not.toContain("bg-destructive");
    // A half-width evacuate button is a bug, not a layout choice.
    expect(em).toContain("w-full");
  });

  it("uses exit green for the safe action", () => {
    expect(buttonStyles({ variant: "safe" })).toContain("bg-safe");
    expect(buttonStyles({ variant: "safe" })).toContain("text-safe-ink");
  });

  it("never ships a filled red button by default", () => {
    const d = buttonStyles({ variant: "destructive" });
    expect(d).toContain("bg-transparent");
    expect(d).toContain("border-destructive");
    expect(d).toContain("hover:bg-destructive");
  });

  it("uses the UI weight, never a heading weight", () => {
    expect(buttonStyles()).toContain("font-medium");
  });
});

describe("inputStyles", () => {
  it("borders with line-control, which clears 3:1 — the decorative line does not", () => {
    expect(inputStyles()).toContain("border-line-control");
  });

  it("marks invalid with the destructive border", () => {
    expect(inputStyles({ invalid: true })).toContain("border-destructive");
  });

  it("never drops below 16px — smaller makes iOS zoom the viewport on focus", () => {
    expect(inputStyles()).toContain("text-base");
  });

  it("is 44px tall and takes the control radius", () => {
    expect(inputStyles()).toContain("h-11");
    expect(inputStyles()).toContain("rounded-md");
  });
});

describe("searchFieldStyles", () => {
  it("is the biggest control in the product — a stressed person's first tap", () => {
    const s = searchFieldStyles();
    expect(s).toContain("h-14");
    expect(s).toContain("rounded-pill");
    expect(s).toContain("text-[1.125rem]");
  });
});

describe("chipStyles", () => {
  it("is a 36px pill that reads differently when selected", () => {
    expect(chipStyles()).toContain("h-9");
    expect(chipStyles()).toContain("rounded-pill");
    expect(chipStyles({ selected: true })).toContain("bg-brand-50");
  });
});

describe("badgeStyles", () => {
  it("renders each tone against its own subtle ground", () => {
    expect(badgeStyles({ tone: "safe" })).toContain("bg-safe-subtle");
    expect(badgeStyles({ tone: "alarm" })).toContain("bg-alarm-subtle");
    expect(badgeStyles({ tone: "brand" })).toContain("bg-brand-50");
  });

  it("is overline type at 22px", () => {
    expect(badgeStyles()).toContain("h-[22px]");
    expect(badgeStyles()).toContain("uppercase");
  });

  it("keeps the deprecated tone names working", () => {
    expect(badgeStyles({ tone: "success" })).toContain("bg-safe-subtle");
    expect(badgeStyles({ tone: "warning" })).toContain("bg-alarm-subtle");
  });
});

describe("cardStyles", () => {
  it("carries a 1px border and no shadow — depth comes from contrast", () => {
    const c = cardStyles();
    expect(c).toContain("rounded-lg");
    expect(c).toContain("border-line");
    expect(c).not.toContain("shadow");
  });
});
