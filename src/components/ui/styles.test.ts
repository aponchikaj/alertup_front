import {
  buttonStyles,
  inputStyles,
  searchFieldStyles,
  chipStyles,
  badgeStyles,
  cardStyles,
} from "./styles";

describe("buttonStyles — iOS button styles", () => {
  it("defaults to `filled`: tint background, white label", () => {
    expect(buttonStyles()).toContain("bg-accent");
    expect(buttonStyles()).toContain("text-accent-ink");
  });

  it("ships the four HIG styles plus glass", () => {
    expect(buttonStyles({ variant: "tinted" })).toContain("bg-accent-wash");
    expect(buttonStyles({ variant: "gray" })).toContain("bg-fill");
    expect(buttonStyles({ variant: "plain" })).toContain("bg-transparent");
    expect(buttonStyles({ variant: "glass" })).toContain("glass");
  });

  it("sizes at 34 / 44 / 50 with 44 the default touch target", () => {
    expect(buttonStyles({ size: "sm" })).toContain("h-[34px]");
    expect(buttonStyles({ size: "md" })).toContain("h-11");
    expect(buttonStyles({ size: "lg" })).toContain("h-[50px]");
    expect(buttonStyles()).toContain("h-11");
  });

  it("regular buttons take r-md; prominent, glass and icon buttons are pills", () => {
    expect(buttonStyles({ size: "md" })).toContain("rounded-md");
    expect(buttonStyles({ size: "lg" })).toContain("rounded-pill");
    expect(buttonStyles({ variant: "glass", size: "sm" })).toContain("rounded-pill");
    expect(buttonStyles({ size: "icon" })).toContain("rounded-pill");
  });

  it("labels are headline weight (600), never a heading weight", () => {
    expect(buttonStyles()).toContain("font-semibold");
    expect(buttonStyles()).not.toContain("font-bold");
  });

  it("presses with opacity + scale — transform only, never a layout property", () => {
    expect(buttonStyles()).toContain("active:scale-[0.97]");
    expect(buttonStyles()).toContain("active:opacity-80");
  });

  it("disables the iOS way: fill background and tertiary label, not a ghosted primary", () => {
    expect(buttonStyles()).toContain("disabled:bg-fill");
    expect(buttonStyles()).toContain("disabled:text-fg-tertiary");
  });

  it("uses orange for emergency, never red, and is always full width", () => {
    const em = buttonStyles({ variant: "emergency" });
    expect(em).toContain("bg-alarm");
    expect(em).toContain("text-alarm-ink");
    expect(em).not.toContain("destructive");
    expect(em).toContain("w-full");
  });

  it("gives the safe action the green fill with a dark label", () => {
    expect(buttonStyles({ variant: "safe" })).toContain("bg-safe");
    expect(buttonStyles({ variant: "safe" })).toContain("text-safe-ink");
  });

  it("destructive is plain red by default — filled red lives only in a sheet", () => {
    const d = buttonStyles({ variant: "destructive" });
    expect(d).toContain("bg-transparent");
    expect(d).toContain("text-destructive-text");
  });
});

describe("inputStyles — iOS text field", () => {
  it("is a fill, not a bordered box", () => {
    const i = inputStyles();
    expect(i).toContain("bg-fill-tertiary");
    expect(i).not.toContain("border-line");
  });

  it("takes a solid 2px focus ring — the alpha ring measured 1.60:1", () => {
    expect(inputStyles()).toContain("focus:ring-2");
    expect(inputStyles()).toContain("focus:ring-ring");
  });

  it("marks invalid with a red ring, never colour on the text alone", () => {
    expect(inputStyles({ invalid: true })).toContain("ring-destructive-text");
  });

  it("is 44px, 17px text, r-sm — under 16px makes iOS zoom the viewport", () => {
    const i = inputStyles();
    expect(i).toContain("h-11");
    expect(i).toContain("text-[17px]");
    expect(i).toContain("rounded-sm");
  });
});

describe("searchFieldStyles", () => {
  it("is the biggest control in the product — 56px pill, 17px text", () => {
    const s = searchFieldStyles();
    expect(s).toContain("h-14");
    expect(s).toContain("rounded-pill");
    expect(s).toContain("bg-fill-tertiary");
  });
});

describe("chipStyles", () => {
  it("is a 36px capsule on fill; selected takes the tint wash", () => {
    expect(chipStyles()).toContain("h-9");
    expect(chipStyles()).toContain("rounded-pill");
    expect(chipStyles()).toContain("bg-fill");
    expect(chipStyles({ selected: true })).toContain("bg-accent-wash");
  });
});

describe("badgeStyles", () => {
  it("is a capsule at caption1 600, sentence case — Apple does not shout", () => {
    const b = badgeStyles();
    expect(b).toContain("rounded-pill");
    expect(b).toContain("h-[22px]");
    expect(b).toContain("font-semibold");
    expect(b).not.toContain("uppercase");
  });

  it("renders each tone as 15% tint + tint text", () => {
    expect(badgeStyles({ tone: "safe" })).toContain("bg-safe-subtle");
    expect(badgeStyles({ tone: "alarm" })).toContain("bg-alarm-subtle");
    expect(badgeStyles({ tone: "brand" })).toContain("bg-accent-wash");
  });

  it("keeps the deprecated tone names working", () => {
    expect(badgeStyles({ tone: "success" })).toContain("bg-safe-subtle");
    expect(badgeStyles({ tone: "warning" })).toContain("bg-alarm-subtle");
  });
});

describe("cardStyles — inset grouped card", () => {
  it("has no border and no drop shadow; the canvas contrast does the work", () => {
    const c = cardStyles();
    expect(c).toContain("card-inset");
    expect(c).not.toContain("border-line");
    expect(c).not.toContain("shadow-");
  });
});
