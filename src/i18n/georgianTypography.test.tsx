import { readFileSync } from "fs";
import { join } from "path";

/* ============================================================================
   Georgian is half this product. The old UI stack had no Georgian coverage at
   all, so Windows fell through to Sylfaen — which ships no bold — and every
   bold Georgian string rendered as a synthesised faux-bold. These assertions
   stop that regressing.
   ========================================================================= */

const css = readFileSync(join(__dirname, "..", "index.css"), "utf8");

describe("Georgian typography", () => {
  it("puts a real Georgian face in the sans stack ahead of any system fallback", () => {
    const stack = /--font-sans:\s*([^;]+);/.exec(css)?.[1] ?? "";
    const georgian = stack.indexOf("Noto Sans Georgian");
    const system = stack.indexOf("system-ui");
    expect(georgian).toBeGreaterThan(-1);
    expect(system).toBeGreaterThan(-1);
    expect(georgian).toBeLessThan(system);
  });

  it("never uppercases Georgian — Mtavruli caps read as shouting, not Title Case", () => {
    expect(css).toMatch(/\[lang="ka"\][\s\S]*?text-transform:\s*none/);
  });

  it("gives Georgian extra leading — only ~5 Mkhedruli letters sit at the x-height", () => {
    expect(css).toMatch(/\[lang="ka"\][\s\S]*?line-height/);
  });

  it("no longer declares the dropped display faces", () => {
    expect(css).not.toMatch(/Dachi The Lynx/);
    expect(css).not.toMatch(/GL Kirovi/);
  });
});

describe("type and rhythm tokens", () => {
  it.each([
    "--weight-body",
    "--weight-ui",
    "--weight-heading",
    "--measure-prose",
    "--measure-text",
    "--measure-tight",
  ])("declares %s", (token) => {
    expect(css + readFileSync(join(__dirname, "..", "styles", "tokens.css"), "utf8")).toContain(
      token,
    );
  });

  it("caps the prose measure in ch — px would not scale with the font size", () => {
    const measure = /--measure-prose:\s*([^;]+);/.exec(css)?.[1] ?? "";
    expect(measure.trim()).toMatch(/ch$/);
  });

  it("keeps kerning and ligatures on — there is no case for leaving them off", () => {
    expect(css).toMatch(/font-feature-settings:\s*"kern"\s*1,\s*"liga"\s*1/);
  });
});
