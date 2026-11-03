import { readFileSync } from "fs";
import { join } from "path";

/* ============================================================================
   The route animations live in CSS, so this is where they can be pinned.
   ----------------------------------------------------------------------------
   RouteLayer draws the path with pathLength={1} and `.route-path-draw`, whose
   ONLY stroke-dashoffset value comes from the keyframes. Under reduced motion
   the rule has to switch the animation OFF (reverting dashoffset to its
   initial 0 — fully drawn) rather than merely shortening it: a near-zero
   duration risks a browser that never paints the final frame, which would
   leave the evacuation line invisible for exactly the people who asked for
   less motion.
   ========================================================================= */

const css = readFileSync(join(__dirname, "..", "..", "index.css"), "utf8");

/** The body of the first @media (prefers-reduced-motion: reduce) block. */
const reducedMotionBlock = (): string => {
  const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
  expect(start).toBeGreaterThan(-1);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error("unterminated @media block");
};

describe("route animations", () => {
  it.each(["route-path-draw", "route-path-march", "map-user-pulse"])(
    ".%s is defined",
    (cls) => {
      expect(css).toContain(`.${cls}`);
    },
  );

  it("turns the route animations off under prefers-reduced-motion", () => {
    const block = reducedMotionBlock();
    for (const cls of ["route-path-draw", "route-path-march", "map-user-pulse"]) {
      expect(block).toContain(`.${cls}`);
    }
    expect(block).toMatch(/animation:\s*none/);
  });

  it("never shortens the draw instead of stopping it", () => {
    // `animation-duration: 0` would keep the keyframes in play and depend on
    // the browser painting the "to" frame. It must be `animation: none`.
    const block = reducedMotionBlock();
    expect(block).not.toMatch(/animation-duration:\s*0/);
  });
});
