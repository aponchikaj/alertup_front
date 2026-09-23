import { readFileSync } from "fs";
import { join } from "path";
import { contrastRatio } from "../lib/contrast";

/* ============================================================================
   The design system's promise is that every foreground/background pair clears
   WCAG 2.2 AA. A promise nothing checks is a promise that breaks silently, so
   this parses the real token file and does the arithmetic.

   It reads tokens.css rather than the rendered DOM deliberately: jsdom does not
   resolve var() chains, and the point is to catch a bad value at the source.
   ========================================================================= */

const css = readFileSync(join(__dirname, "tokens.css"), "utf8");

const sliceBlock = (selector: string): string => {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  return css.slice(open, close);
};

// Primitives are declared on :root and inherited by the dark block, so the dark
// lookup falls back to :root once its own overrides are exhausted.
const LIGHT = sliceBlock(":root {");
const DARK = sliceBlock(':root[data-theme="dark"]') + "\n" + LIGHT;

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

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

describe.each([
  ["light", LIGHT],
  ["dark", DARK],
])("%s theme — WCAG 2.2 AA", (_theme, block) => {
  const t = (token: string) => readToken(block, token);

  it.each([
    ["ink on canvas", "ink", "canvas"],
    ["ink-muted on canvas", "ink-muted", "canvas"],
    ["ink on surface", "ink", "surface"],
    ["ink on surface-2", "ink", "surface-2"],
    ["ink-muted on surface", "ink-muted", "surface"],
    ["brand-ink on brand", "brand-ink", "brand"],
    ["danger-ink on danger", "danger-ink", "danger"],
    ["success-ink on success", "success-ink", "success"],
    ["warning-ink on warning", "warning-ink", "warning"],
    ["info-ink on info", "info-ink", "info"],
    ["danger-text on danger-subtle", "danger-text", "danger-subtle"],
    ["success-text on success-subtle", "success-text", "success-subtle"],
    ["warning-text on warning-subtle", "warning-text", "warning-subtle"],
    ["info-text on info-subtle", "info-text", "info-subtle"],
    ["brand-text on brand-subtle", "brand-text", "brand-subtle"],
  ])("%s clears 4.5:1", (_label, fg, bg) => {
    expect(contrastRatio(t(fg), t(bg))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each([
    ["focus ring on canvas", "ring", "canvas"],
    ["focus ring on surface-2", "ring", "surface-2"],
    ["control border on canvas", "line-control", "canvas"],
    ["control border on surface-2", "line-control", "surface-2"],
  ])("%s clears 3:1", (_label, fg, bg) => {
    expect(contrastRatio(t(fg), t(bg))).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});
