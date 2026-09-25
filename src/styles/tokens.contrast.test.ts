import { readFileSync } from "fs";
import { join } from "path";
import { contrastRatio, hexToRgb } from "../lib/contrast";

/* ============================================================================
   Apple's palette is tuned for a platform with Increase Contrast and Dynamic
   Type behind it. The web has neither, so these ratios are checked here, on
   the real token file, for all three themes. Alpha labels are composited over
   the background they are measured on — which is how the eye sees them.

   Targets: body >= 7, secondary and tinted text >= 4.5, icons/focus >= 3.
   ========================================================================= */

const css = readFileSync(join(__dirname, "tokens.css"), "utf8");

const sliceBlock = (selector: string): string => {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  return css.slice(open, close);
};

const LIGHT = sliceBlock(":root {");
const DARK = sliceBlock(':root[data-theme="dark"]') + "\n" + LIGHT;
const EMERGENCY = sliceBlock(':root[data-mode="emergency"]') + "\n" + LIGHT;

type Color = { hex: string; alpha: number };

const parse = (value: string): Color | null => {
  const v = value.trim();
  if (v.startsWith("#")) return { hex: v, alpha: 1 };
  const m = /rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+))?\s*\)/.exec(v);
  if (!m) return null;
  const toHex = (n: string) => Number(n).toString(16).padStart(2, "0");
  return { hex: `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`, alpha: m[4] ? Number(m[4]) : 1 };
};

/** Resolve a token through var() chains to a colour with alpha. */
const readToken = (block: string, name: string): Color => {
  const seen = new Set<string>();
  let current = name;
  for (let i = 0; i < 14; i += 1) {
    if (seen.has(current)) throw new Error(`Circular token: --${current}`);
    seen.add(current);
    const match = new RegExp(`--${current}\\s*:\\s*([^;]+);`).exec(block);
    if (!match) throw new Error(`Token not found: --${current}`);
    const value = match[1].trim();
    const parsed = parse(value);
    if (parsed) return parsed;
    const alias = /var\(\s*--([a-z0-9-]+)\s*\)/.exec(value);
    if (!alias) throw new Error(`Unresolvable token --${current}: ${value}`);
    current = alias[1];
  }
  throw new Error(`Alias chain too deep for --${name}`);
};

/** Composite fg (with alpha) over an opaque bg, then measure. */
const ratio = (fg: Color, bg: Color): number => {
  if (bg.alpha !== 1) throw new Error("Background must be opaque to measure against");
  const f = hexToRgb(fg.hex);
  const b = hexToRgb(bg.hex);
  const mix = (c: number, d: number) => Math.round(fg.alpha * c + (1 - fg.alpha) * d);
  const composited = `#${[mix(f.r, b.r), mix(f.g, b.g), mix(f.b, b.b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
  return contrastRatio(composited, bg.hex);
};

describe.each([
  ["light", LIGHT],
  ["dark", DARK],
  ["emergency", EMERGENCY],
])("%s theme", (_theme, block) => {
  const t = (n: string) => readToken(block, n);

  it.each([
    ["fg on bg", "fg", "bg"],
    ["fg on card", "fg", "bg-card"],
    ["fg on inset", "fg", "bg-inset"],
  ])("%s clears 7:1 (body)", (_l, fg, bg) => {
    expect(ratio(t(fg), t(bg))).toBeGreaterThanOrEqual(7);
  });

  it.each([
    ["fg-secondary on bg", "fg-secondary", "bg"],
    ["fg-secondary on card", "fg-secondary", "bg-card"],
    ["fg-secondary on inset", "fg-secondary", "bg-inset"],
    ["accent-text on bg", "accent-text", "bg"],
    ["accent-text on card", "accent-text", "bg-card"],
    ["accent-ink on accent (filled button)", "accent-ink", "accent"],
    // The skip link (F15 item 5): buttonStyles({variant:"primary"}) resolves
    // to this same pair. Pinned under its own label so a future change to
    // accent/accent-ink is caught for the skip link too, not eyeballed.
    //
    // HONEST LIMIT: this only checks the TOKEN VALUES. It cannot tell you
    // whether the skip link's rendered anchor actually GETS this pair — that
    // is a cascade/specificity question (which CSS rule wins on the real
    // element), and this file only ever reads tokens.css text, never applies
    // real stylesheets to a real DOM (round 1 of this fix passed this exact
    // assertion while the live page measured 1.68:1, then 1.23:1, because
    // `a:not([data-button])` in typography.css was winning over the utility
    // class this pair names). The mechanism check lives in
    // `Navbar.test.tsx` and `button.test.tsx` (selector-matching against the
    // rendered anchor); only a live browser scan measures the final number.
    ["accent-ink on accent (skip link, focused)", "accent-ink", "accent"],
    ["safe-text on card", "safe-text", "bg-card"],
    ["safe-ink on safe (green fill)", "safe-ink", "safe"],
    ["alarm-text on card", "alarm-text", "bg-card"],
    ["alarm-ink on alarm (orange fill)", "alarm-ink", "alarm"],
    ["destructive-text on card", "destructive-text", "bg-card"],
    ["destructive-ink on destructive", "destructive-ink", "destructive"],
    ["ai-text on card", "ai-text", "bg-card"],
    ["stepfree-text on card", "stepfree-text", "bg-card"],
    ["drill-text on card", "drill-text", "bg-card"],
  ])("%s clears 4.5:1", (_l, fg, bg) => {
    expect(ratio(t(fg), t(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["ring on bg", "ring", "bg"],
    ["ring on card", "ring", "bg-card"],
    ["accent-icon on card", "accent-icon", "bg-card"],
    ["route line on card", "route", "bg-card"],
    ["evacuation route on bg", "route-exit", "bg"],
    ["control border on card", "line-control", "bg-card"],
    ["gray icon on card", "gray", "bg-card"],
  ])("%s clears 3:1 (non-text)", (_l, fg, bg) => {
    expect(ratio(t(fg), t(bg))).toBeGreaterThanOrEqual(3);
  });
});

describe("light-only checks", () => {
  const t = (n: string) => readToken(LIGHT, n);

  it("tinted button: accent-text on the 15% tint wash over a card clears 4.5", () => {
    const wash = t("accent-wash");
    const card = t("bg-card");
    // composite the wash over the card first, then the text over that
    const f = hexToRgb(wash.hex);
    const b = hexToRgb(card.hex);
    const mix = (c: number, d: number) => Math.round(wash.alpha * c + (1 - wash.alpha) * d);
    const washed = `#${[mix(f.r, b.r), mix(f.g, b.g), mix(f.b, b.b)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")}`;
    expect(ratio(t("accent-text"), { hex: washed, alpha: 1 })).toBeGreaterThanOrEqual(4.5);
  });

  it("never puts white on the stock green or orange — both are ~2:1", () => {
    expect(ratio({ hex: "#ffffff", alpha: 1 }, t("safe"))).toBeLessThan(3);
    expect(ratio({ hex: "#ffffff", alpha: 1 }, t("alarm"))).toBeLessThan(3);
    expect(t("safe-ink").hex).toBe("#000000");
    expect(t("alarm-ink").hex).toBe("#000000");
  });

  it("keeps the compat aliases resolving to accessible pairs", () => {
    expect(ratio(t("ink"), t("canvas"))).toBeGreaterThanOrEqual(7);
    expect(ratio(t("ink-muted"), t("canvas"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t("brand-ink"), t("brand"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t("danger-text"), t("surface"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t("success-ink"), t("success"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t("warning-ink"), t("warning"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the skip link (F15 item 5)", () => {
  // `.skip-link` used to set its OWN background/color while the element also
  // wore `buttonStyles({variant:"primary"})`, which sets bg-accent/text-
  // accent-ink — two systems fighting produced 1.68:1, near-invisible text.
  // The fix decides buttonStyles owns the colours; `.skip-link` may only
  // handle position, spacing and elevation from here on.
  //
  // That fix alone was NOT sufficient (round 2): removing `.skip-link`'s own
  // background/color uncovered a second, unrelated rule already fighting the
  // same utility classes — `typography.css`'s `a:not([data-button])`, at
  // higher specificity than `text-accent-ink`. This test still only reads
  // index.css's text, so it cannot see that second rule at all; see
  // `Navbar.test.tsx` for the check that does.
  const indexCss = readFileSync(join(__dirname, "..", "index.css"), "utf8");
  const skipLinkRule = (() => {
    const start = indexCss.indexOf(".skip-link {");
    if (start === -1) throw new Error("`.skip-link` rule not found in index.css");
    const open = indexCss.indexOf("{", start);
    const close = indexCss.indexOf("}", open);
    return indexCss.slice(open, close);
  })();

  it("does not declare its own background or color — buttonStyles owns both", () => {
    expect(skipLinkRule).not.toMatch(/\bbackground\s*:/);
    expect(skipLinkRule).not.toMatch(/\bcolor\s*:/);
  });
});

describe("the emergency switch", () => {
  it("is legible in grayscale — canvas luminance inverts", () => {
    expect(
      ratio(readToken(LIGHT, "bg"), readToken(EMERGENCY, "bg")),
    ).toBeGreaterThanOrEqual(10);
  });

  it("makes orange the tint and keeps the route green", () => {
    expect(readToken(EMERGENCY, "accent").hex).toBe(readToken(EMERGENCY, "orange").hex);
    expect(readToken(EMERGENCY, "route").hex).toBe(readToken(EMERGENCY, "green").hex);
  });

  it("never uses red for the emergency chrome", () => {
    expect(readToken(EMERGENCY, "accent").hex).not.toBe(readToken(EMERGENCY, "red").hex);
    expect(readToken(EMERGENCY, "alarm").hex).not.toBe(readToken(EMERGENCY, "red").hex);
  });
});
