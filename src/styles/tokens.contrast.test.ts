import { readFileSync } from "fs";
import { join } from "path";
import { contrastRatio } from "../lib/contrast";

/* ============================================================================
   The design system promises specific contrast ratios. A promise nothing checks
   is a promise that breaks silently, so this parses the real token file and
   does the arithmetic.

   Targets from the brief: body >= 7:1, secondary >= 4.5:1, button labels
   >= 4.5:1, non-text (a border that IS a control, icons, focus) >= 3:1.
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
// Emergency overrides come first, then :root supplies the primitives it inherits.
const EMERGENCY = sliceBlock(':root[data-mode="emergency"]') + "\n" + LIGHT;

/** Resolve `--name: #hex;` or `--name: var(--other);` down to a literal hex. */
const readToken = (block: string, name: string): string => {
  const seen = new Set<string>();
  let current = name;
  for (let i = 0; i < 12; i += 1) {
    if (seen.has(current)) throw new Error(`Circular token: --${current}`);
    seen.add(current);
    const match = new RegExp(`--${current}\\s*:\\s*([^;]+);`).exec(block);
    if (!match) throw new Error(`Token not found: --${current}`);
    const value = match[1].trim();
    if (value.startsWith("#")) return value;
    const alias = /var\(\s*--([a-z0-9-]+)\s*\)/.exec(value);
    if (!alias) throw new Error(`Unresolvable token --${current}: ${value}`);
    current = alias[1];
  }
  throw new Error(`Alias chain too deep for --${name}`);
};

const BODY = 7;
const SECONDARY = 4.5;
const NON_TEXT = 3;

describe.each([
  ["everyday", LIGHT],
  ["emergency", EMERGENCY],
])("%s mode", (_mode, block) => {
  const t = (token: string) => readToken(block, token);

  it.each([
    ["fg on bg", "fg", "bg"],
    ["fg-body on bg", "fg-body", "bg"],
    ["fg on bg-elevated", "fg", "bg-elevated"],
  ])("%s clears 7:1 (body)", (_l, fg, bg) => {
    expect(contrastRatio(t(fg), t(bg))).toBeGreaterThanOrEqual(BODY);
  });

  it.each([
    ["fg-muted on bg", "fg-muted", "bg"],
    ["fg-muted on bg-subtle", "fg-muted", "bg-subtle"],
    ["accent-ink on accent", "accent-ink", "accent"],
    ["accent-text on bg", "accent-text", "bg"],
    ["safe-ink on safe", "safe-ink", "safe"],
    ["safe-text on bg", "safe-text", "bg"],
    ["alarm-ink on alarm", "alarm-ink", "alarm"],
    ["alarm-text on bg", "alarm-text", "bg"],
    ["destructive-ink on destructive", "destructive-ink", "destructive"],
    ["destructive-text on bg", "destructive-text", "bg"],
  ])("%s clears 4.5:1", (_l, fg, bg) => {
    expect(contrastRatio(t(fg), t(bg))).toBeGreaterThanOrEqual(SECONDARY);
  });

  it.each([
    ["focus ring on bg", "ring", "bg"],
    ["control border on bg", "line-control", "bg"],
    ["control border on bg-elevated", "line-control", "bg-elevated"],
    ["route line on bg", "route", "bg"],
    ["evacuation route on bg", "route-exit", "bg"],
  ])("%s clears 3:1 (non-text)", (_l, fg, bg) => {
    expect(contrastRatio(t(fg), t(bg))).toBeGreaterThanOrEqual(NON_TEXT);
  });
});

describe("compatibility aliases still resolve", () => {
  const t = (token: string) => readToken(LIGHT, token);
  it.each([
    ["ink on canvas", "ink", "canvas"],
    ["ink-muted on canvas", "ink-muted", "canvas"],
    ["brand-ink on brand", "brand-ink", "brand"],
    ["danger-ink on danger", "danger-ink", "danger"],
    ["success-ink on success", "success-ink", "success"],
    ["warning-ink on warning", "warning-ink", "warning"],
    ["info-ink on info", "info-ink", "info"],
  ])("%s clears 4.5:1", (_l, fg, bg) => {
    expect(contrastRatio(t(fg), t(bg))).toBeGreaterThanOrEqual(SECONDARY);
  });
});

describe("the emergency switch is legible without colour", () => {
  it("inverts canvas luminance, so the mode change survives grayscale", () => {
    const everyday = readToken(LIGHT, "bg");
    const emergency = readToken(EMERGENCY, "bg");
    // A stressed person glancing at the screen must register the change before
    // reading a word of it. ~17:1 between the two canvases does that.
    expect(contrastRatio(everyday, emergency)).toBeGreaterThanOrEqual(10);
  });

  it("never puts white on the amber alarm — that pair is 1.83:1", () => {
    const alarm = readToken(LIGHT, "alarm");
    expect(contrastRatio("#ffffff", alarm)).toBeLessThan(4.5);
    expect(contrastRatio(readToken(LIGHT, "alarm-ink"), alarm)).toBeGreaterThanOrEqual(7);
  });
});
