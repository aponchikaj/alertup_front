import { readFileSync } from "fs";
import { join } from "path";

/* ============================================================================
   Georgian is half this product. SF Pro and Inter carry no Mkhedruli, so
   without these guarantees a Georgian heading degrades to whatever the OS
   offers — on Windows, Sylfaen: no bold, faux-bolds everything.
   ========================================================================= */

const type = readFileSync(join(__dirname, "..", "styles", "typography.css"), "utf8");

const stack = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(type)?.[1] ?? "";

describe("Georgian typography", () => {
  it("puts a real Georgian face in the sans stack ahead of any OS fallback", () => {
    const s = stack("font-sans");
    expect(s.indexOf("Noto Sans Georgian")).toBeGreaterThan(-1);
    expect(s.indexOf("Noto Sans Georgian")).toBeLessThan(s.indexOf("system-ui"));
  });

  it("puts Georgian in the rounded stack too — big numbers appear on Georgian screens", () => {
    expect(stack("font-rounded")).toContain("Noto Sans Georgian");
  });

  it("never uppercases Georgian — Mtavruli caps read as shouting, not Title Case", () => {
    expect(type).toMatch(/\[lang="ka"\][\s\S]*?text-transform:\s*none/);
  });

  it("drops the SF-tuned tracking for Georgian", () => {
    expect(type).toMatch(/\[lang="ka"\][\s\S]*?letter-spacing:\s*normal/);
  });

  it("no longer ships a serif or a decorative display face", () => {
    expect(type).not.toMatch(/Instrument Serif|GL Tatishvili|Dachi|Kirovi/);
    expect(type).not.toMatch(/@font-face/);
  });
});

describe("Dynamic Type ladder", () => {
  it.each([
    ["t-large-title", "34px", "41px", "700"],
    ["t-title1", "28px", "34px", "700"],
    ["t-title2", "22px", "28px", "700"],
    ["t-title3", "20px", "25px", "600"],
    ["t-headline", "17px", "22px", "600"],
    ["t-body", "17px", "22px", "400"],
    ["t-callout", "16px", "21px", "400"],
    ["t-subheadline", "15px", "20px", "400"],
    ["t-footnote", "13px", "18px", "400"],
    ["t-caption1", "12px", "16px", "400"],
    ["t-caption2", "11px", "13px", "400"],
  ])(".%s is %s / %s at weight %s", (cls, size, lh, weight) => {
    const rule = new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`).exec(type)?.[1] ?? "";
    expect(rule).toMatch(new RegExp(`font-size:\\s*${size}`));
    expect(rule).toMatch(new RegExp(`line-height:\\s*${lh}`));
    expect(rule).toMatch(new RegExp(`font-weight:\\s*${weight}`));
  });

  it("uses the system font first, at zero bytes on Apple devices", () => {
    expect(stack("font-sans").trim()).toMatch(/^-apple-system/);
  });

  it("never uses a weight below 400 or above 800, and never italic for emphasis", () => {
    const weights = [...type.matchAll(/font-weight:\s*(\d{3})/g)].map((m) => Number(m[1]));
    expect(Math.min(...weights)).toBeGreaterThanOrEqual(400);
    expect(Math.max(...weights)).toBeLessThanOrEqual(800);
    expect(type).toMatch(/em,\s*i\s*\{[^}]*font-style:\s*normal/);
  });

  it("turns on tabular numbers globally so counters never re-flow", () => {
    expect(type).toMatch(/font-feature-settings:\s*"tnum"/);
  });

  it("steps body up to 19px in emergency mode", () => {
    expect(type).toMatch(/\[data-mode="emergency"\][\s\S]*?\.t-body[\s\S]*?font-size:\s*19px/);
  });

  it("respects the OS reduced-motion setting", () => {
    expect(type).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
