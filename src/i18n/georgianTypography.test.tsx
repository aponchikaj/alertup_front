import { readFileSync } from "fs";
import { join } from "path";

/* ============================================================================
   Georgian is half this product, and the display face chosen for the redesign
   (Instrument Serif) has NO Georgian coverage. Without the fallbacks asserted
   here, a Georgian H1 silently degrades to whatever the OS offers — on Windows
   that is Sylfaen, which ships no bold and faux-bolds everything.
   ========================================================================= */

const type = readFileSync(join(__dirname, "..", "styles", "typography.css"), "utf8");

describe("Georgian typography", () => {
  it("puts a real Georgian face in the sans stack ahead of any system fallback", () => {
    const stack = /--font-sans:\s*([^;]+);/.exec(type)?.[1] ?? "";
    const georgian = stack.indexOf("Noto Sans Georgian");
    const system = stack.indexOf("system-ui");
    expect(georgian).toBeGreaterThan(-1);
    expect(system).toBeGreaterThan(-1);
    expect(georgian).toBeLessThan(system);
  });

  it("gives Georgian display text a face that actually has Georgian glyphs", () => {
    // Instrument Serif covers Latin only. GL Tatishvili Metal is a Georgian
    // display cut and carries the serif role for lang=ka.
    const kaDisplay = /\[lang="ka"\] \.t-display-xl[\s\S]*?\}/.exec(type)?.[0] ?? "";
    expect(kaDisplay).toMatch(/GL Tatishvili Metal/);
  });

  it("drops the Latin-tuned negative tracking for Georgian", () => {
    const kaDisplay = /\[lang="ka"\] \.t-display-xl[\s\S]*?\}/.exec(type)?.[0] ?? "";
    expect(kaDisplay).toMatch(/letter-spacing:\s*normal/);
  });

  it("never uppercases Georgian — Mtavruli caps read as shouting, not Title Case", () => {
    expect(type).toMatch(/\[lang="ka"\][\s\S]*?text-transform:\s*none/);
  });

  it("gives Georgian extra leading — only ~5 Mkhedruli letters sit at the x-height", () => {
    const ka = /\[lang="ka"\],\s*\[lang="ka"\] \*\s*\{([\s\S]*?)\}/.exec(type)?.[1] ?? "";
    const lh = /line-height:\s*([\d.]+)/.exec(ka);
    expect(lh).toBeTruthy();
    expect(Number(lh![1])).toBeGreaterThan(1.6);
  });

  it("scopes the Georgian display face by unicode-range, so Latin pages never fetch it", () => {
    expect(type).toMatch(/unicode-range:[^;]*U\+10A0-10FF/i);
  });
});

describe("type system", () => {
  it("caps the measure in ch — px would not scale with the font size", () => {
    const measure = /--measure:\s*([^;]+);/.exec(type)?.[1] ?? "";
    expect(measure.trim()).toMatch(/ch$/);
  });

  it("enables the figure and alternate features the brief asks for", () => {
    const fs = /font-feature-settings:\s*([^;]+);/.exec(type)?.[1] ?? "";
    expect(fs).toContain("cv11");
    expect(fs).toContain("ss01");
    expect(fs).toContain("tnum");
  });

  it("never sets the display serif bold — the face has no business being bold", () => {
    const displayRule =
      /\.t-display-xl,[\s\S]*?\.t-stat\s*\{([\s\S]*?)\}/.exec(type)?.[1] ?? "";
    expect(displayRule).toMatch(/font-weight:\s*400/);
    expect(type).not.toMatch(/--font-display[\s\S]{0,400}font-weight:\s*[67]00/);
  });

  it("gives large display sizes negative tracking, without which the serif looks slack", () => {
    expect(type).toMatch(/\.t-display-xl\s*\{[^}]*letter-spacing:\s*-0\.03em/);
    expect(type).toMatch(/\.t-display-l\s*\{[^}]*letter-spacing:\s*-0\.025em/);
  });

  it("respects the OS reduced-motion setting", () => {
    expect(type).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
