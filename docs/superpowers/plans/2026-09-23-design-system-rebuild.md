# AlertUp Design System Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AlertUp's monochrome design system with a two-register "Instrument" system — a graphite chassis for the calm product and quarantined ISO 3864 safety colours for emergencies — then rebuild the home and 404 pages on top of it.

**Architecture:** Values-only token swap. Every semantic token name in `src/styles/tokens.css` is preserved, so the ~99 existing components re-skin without edits; only the primitive values and a handful of recipe files change. The brand ramp is isolated as one swappable 11-value block so both candidate brand colours can be rendered from the same build. A new contrast-guard test parses the token file and fails CI on any pair that drops below WCAG 2.2 AA, so the system cannot silently regress.

**Tech Stack:** Vite 7, React 18, TypeScript, Tailwind CSS 4 (`@theme inline`), react-router-dom 7, Jest + Testing Library, `@fontsource-variable/inter`, `@fontsource-variable/noto-sans-georgian`.

**Spec:** `RESEARCHS/001-design-system-rebuild-2026-09/` — read `RESEARCH.md` for the evidence and `DESIGN-DIRECTION.md` for the system being built. `tokens.draft.css` in that folder is the source for Task 2. `verify-contrast.py` reproduces every ratio quoted here.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Branch:** all work happens on `stage` in `alertup_front/`. Never commit on `pre-prod` or `main`. Never force-push.
- **Never commit `.env`.** It is gitignored and holds `VITE_API_URL=http://localhost:3001`.
- **The two registers never mix.** CALM surfaces may not use a SIGNAL colour; SIGNAL colours may not appear as decoration. Brand chroma never touches map geometry, route lines, or status.
- **No component may reference a primitive token.** Components consume semantics (`--brand`, `--ink`, `--danger`). Only `tokens.css` maps primitives to semantics. This is the invariant worth enforcing, not the tier count.
- **Every state encoded in colour is also encoded in shape or text.** Verified: red vs amber collapses to 24.0 (deuteranopia) and 4.2 (tritanopia) separation. Colour alone is never sufficient.
- **No flashing anywhere.** WCAG 2.3.1. Emergency attention comes from size, position, and colour arriving where colour never is.
- **Contrast floor:** WCAG 2.2 AA — 4.5:1 body text, 3:1 large text and non-text. Cite WCAG 2.2 AA externally; APCA is an internal target only and is not yet a standard.
- **Touch targets:** ≥44px (already met; WCAG 2.2 SC 2.5.8 floor is 24×24).
- **File naming:** components exporting JSX are `PascalCase.tsx`; everything else `camelCase.ts`. No JSX in a `.ts` file. Imports extensionless and relative. Tests sit next to what they test.
- **Verification before any "done" claim:** `npm run lint`, `npm test`, and `npm run build` must all pass. `npm run build` includes `tsc -b`, the SEO generator and the SEO check.
- **Commit after every task.** Small, revertible commits.
- **Three weights only:** 400 body, 500 UI, 600 heading. `font-bold` is the emergency register and the display face, nowhere else.
- **Spacing is 4px-based with no half-steps** in new code — `gap-1.5`, `p-7`, `mt-0.5` are banned except for documented optical icon alignment.
- **Every paragraph is measure-capped.** Nothing exceeds `--measure-prose` (68ch).
- **Every data surface ships four states:** loading (skeleton in the content's shape), empty (says what and why plus the fixing action), error (plain language plus retry), partial. A happy path alone is an unfinished screen.
- **Nothing is hover-only.** Every hover affordance has focus and touch equivalents.

### Decisions already made (do not re-litigate)

| Decision | Choice |
|---|---|
| Brand hue | **Build both.** Purple `#7629BF` is the default ramp; Civic navy `#16355E` ships as a commented alternate in the same file. Final pick happens in Task 11 from real screenshots. |
| Typography | **Inter + Noto Sans Georgian** (both variable, self-hosted via `@fontsource-variable`). Keep `GL Tatishvili Metal` for headings. **Delete `DachiTheLynx.otf` and `GLKirovi-Bold.ttf`.** |
| Scope | **Staged.** Tasks 1–8 are Pass 1 (foundation + primitives + gallery), then a review checkpoint. Tasks 9–11 are Pass 2 (pages). |
| Icons | **Keep the existing hand-rolled set.** `src/components/ui/icons.tsx` is already an outline family on a 24px grid at 1.75 stroke using `currentColor` — exactly what the research recommended. Adding `lucide-react` would be a dependency for no gain. Only the ISO 7010 safety register is new. |

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/styles/tokens.css` *(replaced)* | Primitives (graphite, brand, signal) → semantics. The only file that knows a hex value. |
| `src/styles/tokens.contrast.test.ts` | Parses `tokens.css`, computes WCAG ratios, fails on any pair below AA. The regression guard. |
| `src/lib/contrast.ts` | Pure colour maths: `hexToRgb`, `relativeLuminance`, `contrastRatio`. No React. |
| `src/components/ui/safetyIcons.tsx` | ISO 7010 pictogram register. Separate file so it can never be imported by accident alongside UI icons. |
| `src/pages/other/designGallery.tsx` | `/_design` — every component in every state, both themes. The review surface. |
| `src/components/ui/emergencyBanner.test.tsx` *(extends existing)* | Asserts `role="alert"`. |
| `src/styles/rhythm.test.ts` | Pins the weight, measure and type-scale tokens. |
| `src/components/ui/states.test.tsx` | Pins the empty-state contract. |

**Modified:**

| File | Change |
|---|---|
| `src/index.css` | Font imports, `@theme inline` additions (`--color-line-control`, map tokens), `lang="ka"` rules |
| `src/components/ui/styles.ts` | New radii, `emergency` button variant, `--line-control` on inputs, dark-mode focus ring |
| `src/components/ui/layout.tsx` | Measure caps, type-scale steps, eyebrow tracking |
| `src/components/ui/button.tsx` | Accept the new variant/size in types |
| `src/components/ui/field.tsx` | Labels above, inline errors with icon |
| `src/components/emergency/EmergencyBanner.tsx` | `role="alert"` / `aria-live="assertive"` |
| `src/App.tsx` | Register the `/_design` route |
| `src/pages/home.tsx` | Rebuilt (Pass 2) |
| `src/pages/other/pageNotFound.tsx` | Rebuilt (Pass 2) |

**Deleted:** `src/assets/fonts/DachiTheLynx.otf`, `src/assets/fonts/GLKirovi-Bold.ttf`

---

# PASS 1 — Foundation and primitives

---

### Task 1: Ship the life-safety `aria-live` fix

Independent of the redesign. This is a real defect and it goes first so it is not held hostage to anything else.

**Files:**
- Modify: `src/components/emergency/EmergencyBanner.tsx:24-31`
- Test: `src/components/emergency/emergencyUi.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing. Behavioural fix only.

- [ ] **Step 1: Write the failing test**

Append to `src/components/emergency/emergencyUi.test.tsx`:

The file already defines `renderWithI18n(ui)` at the top — use it, do not add a second wrapper.

```tsx
describe("EmergencyBanner", () => {
  test("announces assertively — a life-safety alert must not wait for a pause", () => {
    renderWithI18n(<EmergencyBanner />);
    const banner = screen.getByTestId("emergency-banner");
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveAttribute("aria-live", "assertive");
  });
});
```

Note the file uses `test(...)`, not `it(...)` — match it.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/emergency/emergencyUi.test.tsx -t "announces assertively"`
Expected: FAIL — `Expected element to have attribute role="alert", received "status"`

- [ ] **Step 3: Apply the fix**

In `src/components/emergency/EmergencyBanner.tsx`, change:

```tsx
    <div
      role="status"
      aria-live="polite"
```

to:

```tsx
    // `assertive`, not `polite`: polite makes the screen reader wait for a
    // pause before announcing. The building is on fire; it does not wait.
    <div
      role="alert"
      aria-live="assertive"
```

- [ ] **Step 4: Run the full emergency suite**

Run: `npx jest src/components/emergency src/emergency`
Expected: PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/components/emergency/EmergencyBanner.tsx src/components/emergency/emergencyUi.test.tsx
git commit -m "fix(emergency): announce banner assertively, not politely

role=status/aria-live=polite makes a screen reader wait for a pause before
announcing. For a persistent 'building is in emergency' banner that is the
wrong register. Ships independently of the design rebuild."
```

---

### Task 2: Replace the token layer

**Files:**
- Create: `src/lib/contrast.ts`
- Create: `src/styles/tokens.contrast.test.ts`
- Replace: `src/styles/tokens.css`
- Source: `RESEARCHS/001-design-system-rebuild-2026-09/tokens.draft.css`

**Interfaces:**
- Produces: `contrastRatio(a: string, b: string): number` from `src/lib/contrast.ts`, used by Task 2's guard test and available to any later task.
- Produces: semantic CSS custom properties, names unchanged from the current file, plus one new token `--line-control`, plus the `--map-*` block.

- [ ] **Step 1: Write the contrast helper**

Create `src/lib/contrast.ts`:

```ts
/* Pure WCAG 2.x contrast maths. No React, no DOM — so the token guard test can
   run in any environment and so the numbers in the design docs are checkable
   from code rather than trusted. */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const hexToRgb = (hex: string): Rgb => {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a 6-digit hex colour: "${hex}"`);
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
};

const channel = (value: number): number => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = (hex: string): number => {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const contrastRatio = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
};
```

- [ ] **Step 2: Write the failing guard test**

Create `src/styles/tokens.contrast.test.ts`:

```ts
import { readFileSync } from "fs";
import { join } from "path";
import { contrastRatio } from "../lib/contrast";

/* The design system's promise is that every foreground/background pair clears
   WCAG 2.2 AA. A promise nothing checks is a promise that breaks silently, so
   this parses the real token file and does the arithmetic. */

const css = readFileSync(join(__dirname, "tokens.css"), "utf8");

/** Pull a `--name: #hex;` or `--name: var(--other);` and resolve aliases. */
const readToken = (block: string, name: string): string => {
  const seen = new Set<string>();
  let current = name;
  for (let i = 0; i < 10; i += 1) {
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

const sliceBlock = (selector: string): string => {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  return css.slice(open, close);
};

// Primitives live on :root and are inherited by the dark block, so the dark
// block is read against the whole file with :root as fallback.
const LIGHT = sliceBlock(":root {");
const DARK = sliceBlock(':root[data-theme="dark"]') + LIGHT;

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

describe.each([
  ["light", LIGHT],
  ["dark", DARK],
])("%s theme — WCAG 2.2 AA", (_name, block) => {
  const t = (token: string) => readToken(block, token);

  it.each([
    ["ink on canvas", "ink", "canvas"],
    ["ink-muted on canvas", "ink-muted", "canvas"],
    ["ink on surface", "ink", "surface"],
    ["ink on surface-2", "ink", "surface-2"],
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
    ["control border on canvas", "line-control", "canvas"],
    ["control border on surface-2", "line-control", "surface-2"],
  ])("%s clears 3:1", (_label, fg, bg) => {
    expect(contrastRatio(t(fg), t(bg))).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest src/styles/tokens.contrast.test.ts`
Expected: FAIL — `Token not found: --line-control` (the current file has no such token), and the ring assertion fails in dark mode.

- [ ] **Step 4: Replace the token file**

```bash
cp ../RESEARCHS/001-design-system-rebuild-2026-09/tokens.draft.css src/styles/tokens.css
```

Then edit the copied file's header comment: change `DRAFT (research 001)` to `Instrument` and drop the "Drop-in replacement" paragraph — it is now the real file, not a proposal.

**Preserve the `.on-dark` block.** The draft merges it with `:root[data-theme="dark"]` via a selector list, which is correct — but confirm `.on-dark` still sets `background-color` and `color`, because `pages/home.tsx` relies on it for the hero.

- [ ] **Step 5: Run the guard test**

Run: `npx jest src/styles/tokens.contrast.test.ts`
Expected: PASS — all pairs in both themes.

If `warning-ink on warning` fails, the ink is wrong: warning takes **black** ink (`--slate-950`) on ISO yellow, which is 9.60:1. White on that yellow is 1.98:1. Do not darken the yellow to "fix" it; that breaks the ISO colour match.

- [ ] **Step 6: Map the new tokens into Tailwind**

In `src/index.css`, inside `@theme inline`, add after the existing `--color-line-strong` line:

```css
  --color-line-control: var(--line-control);

  /* Map — ISO 23601. Consumed by the 2D canvas and the three.js scene, which
     resolves these through getComputedStyle so it re-tints on theme flip. */
  --color-map-route-horizontal: var(--map-route-horizontal);
  --color-map-route-vertical: var(--map-route-vertical);
  --color-map-route-arrow: var(--map-route-arrow);
  --color-map-you-are-here: var(--map-you-are-here);
  --color-map-fire-equipment: var(--map-fire-equipment);
  --color-map-wall: var(--map-wall);
  --color-map-room: var(--map-room);
  --color-map-label: var(--map-label);
```

- [ ] **Step 7: Verify the whole suite and the build**

Run: `npm test && npm run lint && npm run build`
Expected: all pass. The visual result will look wrong until Task 4 — that is expected; only correctness is being checked here.

- [ ] **Step 8: Commit**

```bash
git add src/lib/contrast.ts src/styles/tokens.css src/styles/tokens.contrast.test.ts src/index.css
git commit -m "feat(design): replace token layer with graphite chassis + ISO signal register

Semantic names unchanged, so every consumer re-skins without edits. Adds
--line-control (the old --line is 1.40:1 and cannot legally border a control)
and the ISO 23601 map tokens. tokens.contrast.test.ts parses the real file and
fails CI on any pair below WCAG 2.2 AA."
```

---

### Task 3: Typography — end the faux-bold Georgian

**Files:**
- Modify: `src/index.css:1-50`
- Modify: `package.json`
- Delete: `src/assets/fonts/DachiTheLynx.otf`, `src/assets/fonts/GLKirovi-Bold.ttf`
- Test: `src/i18n/georgianTypography.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `--font-sans`, `--font-display`, `--font-mono` on `@theme inline`. `--font-alt` and `--font-accent` are **removed** — grep for them before deleting.

- [ ] **Step 1: Confirm nothing still uses the dropped faces**

Run:

```bash
grep -rn "font-alt\|font-accent\|Dachi\|GLKirovi\|GL Kirovi" src/ || echo "CLEAR — safe to remove"
```

If anything matches, change those call sites to `font-display` in this task before proceeding.

- [ ] **Step 2: Install the variable font packages**

```bash
npm install @fontsource-variable/inter@5 @fontsource-variable/noto-sans-georgian@5
```

Self-hosted, so no external CDN request and no CSP question.

- [ ] **Step 3: Write the failing test**

Create `src/i18n/georgianTypography.test.tsx`:

```tsx
import { readFileSync } from "fs";
import { join } from "path";

/* Georgian is half this product. On Windows the old system stack fell through
   to Sylfaen, which ships no bold, so every bold Georgian string rendered as a
   synthesised faux-bold. These assertions stop that regressing. */

const css = readFileSync(join(__dirname, "..", "index.css"), "utf8");

describe("Georgian typography", () => {
  it("puts a real Georgian face in the sans stack before any system fallback", () => {
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
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx jest src/i18n/georgianTypography.test.tsx`
Expected: FAIL on all four.

- [ ] **Step 5: Rewrite the font block in `src/index.css`**

Replace the `@import "tailwindcss";` line and the whole `@font-face` section with:

```css
@import "tailwindcss";

/* Variable, self-hosted. Inter carries Latin, Noto Sans Georgian carries
   Mkhedruli — both with real weights, which is the point: the previous system
   stack had no Georgian coverage at all, so Windows fell through to Sylfaen,
   which ships no bold and faux-bolded every Georgian heading. */
@import "@fontsource-variable/inter";
@import "@fontsource-variable/noto-sans-georgian";

@import "./styles/tokens.css";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

/* The one remaining custom face: a Georgian-designed display cut, used for
   headings and brand moments only. Body and UI text never use it. */
@font-face {
  font-family: "GL Tatishvili Metal";
  src: url("./assets/fonts/GLTatishviliMetal-Bold.ttf") format("truetype");
  font-weight: 400 800;
  font-display: swap;
}
```

Then in `@theme inline`, replace the four font declarations with:

```css
  --font-sans: "Inter Variable", "Noto Sans Georgian Variable", ui-sans-serif,
    system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-display: "GL Tatishvili Metal", "Noto Sans Georgian Variable",
    "Inter Variable", system-ui, sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", "Cascadia Mono", Menlo, monospace;
```

Delete `--font-alt` and `--font-accent`.

- [ ] **Step 6: Add the Georgian-specific rules**

Append to `src/index.css`:

```css
/* ============================================================================
   Georgian (Mkhedruli) needs different vertical metrics from Latin: only about
   five letters of ~40 sit at the x-height, so runs need more ascender and
   descender room. And Mkhedruli has no case — Mtavruli "capitals" apply to a
   whole word minimum and read as ALL-CAPS SHOUTING, never as Title Case, so
   uppercase transforms are disabled outright rather than per-component.
   ========================================================================= */
[lang="ka"],
[lang="ka"] * {
  line-height: 1.63;
  text-transform: none;
}

/* Numbers must not jitter as they change — counts, floor numbers, metrics. */
.tabular,
table {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 7: Delete the dropped font files**

```bash
git rm src/assets/fonts/DachiTheLynx.otf src/assets/fonts/GLKirovi-Bold.ttf
```

- [ ] **Step 8: Verify**

Run: `npx jest src/i18n/georgianTypography.test.tsx && npm run lint && npm run build`
Expected: all four assertions PASS, build clean.

- [ ] **Step 9: Verify Georgian renders in a real browser**

Open `http://localhost:5173`, switch the language toggle to Georgian, and confirm headings and bold text render in Noto Sans Georgian rather than a fallback. In DevTools, the Computed → Rendered Fonts panel must name **Noto Sans Georgian Variable** for Georgian runs. Note what it reports — if it names anything else, the stack order is wrong.

- [ ] **Step 10: Commit**

```bash
git add -A src/index.css src/i18n/georgianTypography.test.tsx package.json package-lock.json src/assets/fonts
git commit -m "feat(type): real Georgian font, Inter for Latin, drop two display faces

Georgian had no font in the UI stack: Windows fell through to Sylfaen, which
ships no bold, so every bold Georgian string was a synthesised faux-bold.
Self-hosted variable Inter + Noto Sans Georgian fix it in both scripts.
Disables uppercase for lang=ka (Mtavruli is shouting, not capitalisation) and
adds Georgian-specific leading. Drops Dachi The Lynx and GL Kirovi (-166 KB)."
```

---

---

### Task 3B: The UX system — spacing, weight, measure and rhythm

The design system so far says what things *look* like. This task says how they are *arranged*, which is
what actually makes an interface feel designed rather than assembled.

**Audit that motivates this task** (run against the current codebase):

```
font-semibold  121 uses     <- everything is emphasised, so nothing is
font-medium     64
font-bold       13
font-normal      4

gap-2 100 | gap-3 83 | gap-4 66 | gap-1.5 39 | gap-5 25 | gap-2.5 15 | gap-1 15
                            ^^^^^^^^^^^^^^^^^^^^^^^^^^^ half-steps, drifting off-grid
text-sm 154 | text-xs 67    <- the product is set almost entirely below body size
```

**Files:**
- Modify: `src/index.css` (`@theme inline` — spacing, weight, measure tokens)
- Modify: `src/components/ui/layout.tsx` (rhythm applied to the primitives)
- Create: `src/styles/rhythm.test.ts`

**Interfaces:**
- Produces: `--text-*` size/leading/tracking triples, `--weight-*` tokens, `--measure-*` widths, and a
  restricted spacing scale. Consumed by Tasks 4–10 and every future page.

#### The four rules this task encodes

**1. Three weights, not five.** Inter Variable exposes 100–900; the product uses exactly three.

| Token | Value | Use | Never |
|---|---|---|---|
| `--weight-body` | 400 | All body copy, descriptions, help text | — |
| `--weight-ui` | 500 | Buttons, labels, table headers, nav, badges | Paragraphs |
| `--weight-heading` | 600 | h1–h4, section titles, card titles | Body text |

`font-bold` (700) is reserved for the emergency register and the display face. There is no 800/900 in
the product. Butterick's rule: bold *or* italic, never both, and as little as possible. Sans-serif
italic barely reads, so AlertUp uses **bold only** for emphasis and uses it rarely.

**Dark mode drops one step.** Light-on-dark text renders optically heavier, so `--weight-heading`
resolves to 550 in dark mode. This is why the weights are tokens and not literals.

**2. One spacing scale, no half-steps.** 4px base. The permitted set:

```
space-1   4px   icon-to-label, inline nudges
space-2   8px   related items in a row
space-3  12px   form control internals
space-4  16px   default gap between siblings
space-6  24px   card padding, group separation
space-8  32px   between distinct groups
space-12 48px   between subsections
space-16 64px   between sections (mobile)
space-24 96px   between sections (desktop)
```

`gap-1.5`, `gap-2.5`, `p-7`, `mt-0.5` and friends are **banned in new code**. The single exception is
optical alignment of an icon against text (`mt-0.5` on a 16px icon beside a 14px line), which must carry
a comment saying so. Existing violations are not swept in this task — they get fixed as each file is
touched.

**3. Measure is capped, always.** The single most common responsive failure is that images and nav are
scaled carefully while body text runs edge to edge.

| Token | Width | Use |
|---|---|---|
| `--measure-prose` | 68ch | Long-form reading: legal, help, docs |
| `--measure-text` | 60ch | Section descriptions, card body |
| `--measure-tight` | 44ch | Hero subheads, empty-state copy |

No paragraph anywhere is allowed to exceed `--measure-prose`.

**4. Size carries hierarchy; weight does not.** Current code reaches for `font-semibold` to make
something important. That flattens — 121 semibold elements means none of them read as primary. Hierarchy
comes from size and space first, weight last.

- [ ] **Step 1: Write the failing test**

Create `src/styles/rhythm.test.ts`:

```ts
import { readFileSync } from "fs";
import { join } from "path";

/* The rhythm rules are only real if something checks them. This reads the
   actual theme block rather than trusting a doc that drifts. */

const css = readFileSync(join(__dirname, "..", "index.css"), "utf8");

describe("type and rhythm tokens", () => {
  it.each([
    "--weight-body",
    "--weight-ui",
    "--weight-heading",
    "--measure-prose",
    "--measure-text",
    "--measure-tight",
  ])("declares %s", (token) => {
    expect(css).toContain(token);
  });

  it("caps the prose measure in ch, not px — px does not scale with font size", () => {
    const measure = /--measure-prose:\s*([^;]+);/.exec(css)?.[1] ?? "";
    expect(measure).toMatch(/ch\s*$/);
  });

  it("body weight is 400 — body text is never set in a UI weight", () => {
    expect(/--weight-body:\s*400/.test(css)).toBe(true);
  });

  it("drops heading weight in dark mode, where light-on-dark renders heavier", () => {
    const dark = css.slice(css.indexOf('[data-theme="dark"]'));
    expect(dark).toMatch(/--weight-heading/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/styles/rhythm.test.ts`
Expected: FAIL — none of the tokens exist yet.

- [ ] **Step 3: Add the tokens to `src/index.css`**

Inside `@theme inline`, after the font declarations:

```css
  /* --- Weight ------------------------------------------------------------
     Three weights, deliberately. An audit of the old system found 121 uses of
     font-semibold against 64 of font-medium: when everything is emphasised,
     nothing is. Hierarchy comes from size and space; weight is the last
     resort, not the first. */
  --weight-body: 400;
  --weight-ui: 500;
  --weight-heading: 600;

  /* --- Measure -----------------------------------------------------------
     Set in ch so the cap scales with the font size instead of fighting it.
     No paragraph in the product exceeds --measure-prose. */
  --measure-prose: 68ch;
  --measure-text: 60ch;
  --measure-tight: 44ch;

  /* --- Type scale --------------------------------------------------------
     Each step carries its own leading and tracking. Large text gets tighter
     tracking and leading; small text gets looser. Body never drops below 16px
     — on mobile inputs anything smaller makes iOS zoom the viewport. */
  --text-display: 3rem;      --text-display--line-height: 1.05;  --text-display--letter-spacing: -0.02em;
  --text-h1: 2rem;           --text-h1--line-height: 1.15;       --text-h1--letter-spacing: -0.015em;
  --text-h2: 1.5rem;         --text-h2--line-height: 1.25;       --text-h2--letter-spacing: -0.01em;
  --text-h3: 1.1875rem;      --text-h3--line-height: 1.35;
  --text-body: 1rem;         --text-body--line-height: 1.55;
  --text-sm: 0.875rem;       --text-sm--line-height: 1.5;
  --text-xs: 0.75rem;        --text-xs--line-height: 1.45;       --text-xs--letter-spacing: 0.01em;
```

Then append, outside the theme block:

```css
/* ============================================================================
   Baseline typography. Kerning and ligatures on everywhere — there is no case
   for leaving them off. Headings never hyphenate.
   ========================================================================= */
html {
  font-feature-settings: "kern" 1, "liga" 1;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4 {
  font-weight: var(--weight-heading);
  hyphens: none;
  text-wrap: balance;
}

p {
  text-wrap: pretty;
}

/* Uppercase is only legible in short runs, and only when letterspaced — caps
   are homogeneous rectangles, so the eye loses the word contour without it. */
.uppercase,
[class*="uppercase"] {
  letter-spacing: 0.08em;
}

/* Links carry a real underline, offset so descenders stay readable. Removing
   the underline and relying on colour fails anyone who cannot see the colour. */
a:not([class*="btn"]):not([class*="rounded"]) {
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
}
```

- [ ] **Step 4: Add the dark-mode weight drop to `src/styles/tokens.css`**

In the `:root[data-theme="dark"], .on-dark` block:

```css
  /* Light-on-dark renders optically heavier than dark-on-light — the same
     numeric weight looks bolder. Drop a half-step so dark mode reads at the
     same visual weight as light. */
  --weight-heading: 550;
```

And in `:root`, alongside the other semantics: `--weight-heading: 600;`
Then in `@theme inline`, change `--weight-heading: 600;` to `--weight-heading: var(--weight-heading);`
— matching how the colour tokens already indirect, so the value re-resolves per theme.

- [ ] **Step 5: Apply the rhythm to the layout primitives**

In `src/components/ui/layout.tsx`:

- `SectionHeading`: the eyebrow's `tracking-[0.14em]` becomes `tracking-[0.08em]` (0.14em is past the
  point where letters could fit in the gaps). Its `text-3xl ... sm:text-4xl` title becomes
  `text-h1`. Its description gains `max-w-[--measure-text]` instead of `max-w-2xl`.
- `PageHeader`: same title treatment; description capped at `--measure-text`.
- `Container`: `prose` width changes from `max-w-3xl` to `max-w-[--measure-prose]` — a character-based
  cap rather than a pixel one.
- `Section`: `py-16 sm:py-20 lg:py-24` is already on-scale; leave it.

- [ ] **Step 6: Verify**

Run: `npx jest src/styles/rhythm.test.ts && npm test && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/index.css src/styles/tokens.css src/styles/rhythm.test.ts src/components/ui/layout.tsx
git commit -m "feat(design): spacing, weight and measure system

Three weights, not five: an audit found 121 font-semibold against 64
font-medium, which is the 'everything emphasised so nothing is' failure.
Hierarchy now comes from size and space. Caps every measure in ch, adds
per-step leading and tracking, and drops heading weight a half-step in dark
mode where light-on-dark renders optically heavier."
```

---

### Task 7B: UX state patterns — the four states every surface has

A screen is not one design. It is four, and teams routinely ship only the happy one.

**Files:**
- Modify: `src/components/ui/feedback.tsx` (`EmptyState`, `Skeleton`)
- Create: `src/components/ui/states.test.tsx`

**The contract every data surface honours:**

| State | Requirement |
|---|---|
| **Loading** | A skeleton in the shape of the real content — never a centred spinner that reflows the page when data lands. Reserve the space (CLS < 0.1). |
| **Empty** | Says what would be here, why it is not, and gives the one action that fixes it. Never just "No data". |
| **Error** | Says what failed in plain language, and offers a retry. Never a raw status code. |
| **Partial** | Some data, some failed — show what loaded and flag what did not. Never discard good data because one call failed. |

**Interaction rules, applied everywhere:**

- **Feedback is immediate.** Any action taking >100ms shows a pending state on the control that was
  pressed — not a global overlay. `Button` already has `loading`; use it.
- **Destructive actions confirm**, and the confirm button names the act ("Delete building"), never "OK".
  `ConfirmDialog` exists; route every destructive path through it.
- **Focus is managed.** Opening a dialog moves focus into it; closing returns focus to the trigger.
  `useFocusTrap` exists in `overlayUtils.ts` — no dialog may skip it.
- **Errors appear next to their cause**, never only summarised at the top of a form.
- **Nothing is hover-only.** Every hover affordance has a focus and a touch equivalent — a hover-only
  control does not exist on a phone, which is where evacuation happens.
- **Progressive disclosure.** Under stress, working memory shrinks. Emergency surfaces show one decision
  at a time; advanced admin options live behind a disclosure, not on first paint.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/states.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./feedback";

describe("EmptyState", () => {
  it("explains the emptiness and offers the action that resolves it", () => {
    render(
      <EmptyState
        title="No buildings yet"
        description="Add a building to start mapping floors and exits."
        action={<button type="button">Add building</button>}
      />,
    );
    expect(screen.getByText("No buildings yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add building" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx jest src/components/ui/states.test.tsx`

If `EmptyState` already supports this shape, the test passes immediately — **record that and move on**.
Do not refactor a component that already meets the contract.

- [ ] **Step 3: Audit the existing states**

```bash
grep -rn "EmptyState\|Skeleton" src/pages | head -20
grep -rln "loading" src/pages | head -20
```

For each page that fetches data, confirm it renders all four states. List the gaps in the checkpoint
report rather than fixing them all here — most live in pages that are out of scope for this pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/states.test.tsx src/components/ui/feedback.tsx
git commit -m "test(ui): pin the empty-state contract"
```

---

### Task 4: Button recipes and the `emergency` variant

**Files:**
- Modify: `src/components/ui/styles.ts:19-70`
- Modify: `src/components/ui/button.tsx`
- Test: `src/components/ui/styles.test.ts`

**Interfaces:**
- Produces: `ButtonVariant` gains `"emergency"`; `ButtonSize` gains `"xl"`. `buttonStyles({ variant, size, fullWidth, className })` signature is otherwise unchanged, so every existing call site keeps working.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/styles.test.ts`:

```ts
import { buttonStyles, inputStyles, badgeStyles } from "./styles";

describe("buttonStyles", () => {
  it("defaults to the brand-filled primary", () => {
    expect(buttonStyles()).toContain("bg-brand");
    expect(buttonStyles()).toContain("text-brand-ink");
  });

  it("uses a 10px radius, not a pill — this is equipment, not marketing", () => {
    expect(buttonStyles()).toContain("rounded-md");
    expect(buttonStyles()).not.toContain("rounded-full");
  });

  it("exposes an emergency variant that is physically larger than everything else", () => {
    const emergency = buttonStyles({ variant: "emergency", size: "xl" });
    expect(emergency).toContain("bg-danger");
    expect(emergency).toContain("text-danger-ink");
    expect(emergency).toContain("h-14");
    expect(emergency).toContain("w-full");
  });

  it("keeps every button at or above the 44px touch floor", () => {
    expect(buttonStyles({ size: "sm" })).toContain("min-h-11");
    expect(buttonStyles({ size: "md" })).toContain("min-h-11");
  });
});

describe("inputStyles", () => {
  it("borders with line-control, which clears 3:1 — plain line does not", () => {
    expect(inputStyles()).toContain("border-line-control");
  });

  it("marks invalid with the danger border, never colour alone at the call site", () => {
    expect(inputStyles({ invalid: true })).toContain("border-danger");
  });
});

describe("badgeStyles", () => {
  it("renders each tone against its own subtle ground", () => {
    expect(badgeStyles({ tone: "danger" })).toContain("bg-danger-subtle");
    expect(badgeStyles({ tone: "success" })).toContain("bg-success-subtle");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/components/ui/styles.test.ts`
Expected: FAIL — `rounded-full` is present, `emergency` is not a valid variant (TypeScript error), `border-line-control` absent.

- [ ] **Step 3: Update the recipes in `src/components/ui/styles.ts`**

Change the type exports:

```ts
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "subtle"
  | "link"
  | "emergency";
export type ButtonSize = "sm" | "md" | "lg" | "xl" | "icon" | "icon-sm";
```

In `BUTTON_BASE`, change `"font-medium rounded-full select-none"` to:

```ts
  // 10px, not a pill. Pills read consumer/marketing; this is software a fire
  // marshal has to trust.
  "font-medium rounded-md select-none",
```

Add to `BUTTON_VARIANTS`:

```ts
  /* The SIGNAL register's only button. Deliberately unmistakable: it is the
     one control in the product allowed to wear a saturated fill, and it is
     taller and wider than anything around it so it cannot be mis-tapped. */
  emergency: cn(
    "bg-danger text-danger-ink shadow-md font-semibold tracking-wide",
    "hover:brightness-110 focus-visible:outline-danger",
  ),
```

Add to `BUTTON_SIZES`:

```ts
  xl: "h-14 min-h-14 px-8 text-base",
```

And in `buttonStyles`, after the `variant === "link"` line, add:

```ts
    // Emergency is always full width — a half-width evacuate button is a bug.
    variant === "emergency" && "w-full",
```

- [ ] **Step 4: Update the input recipe in the same file**

In `inputStyles`, change `rounded-xl` to `rounded-md`, and change the valid-state border:

```ts
    invalid
      ? "border-danger focus:border-danger focus:ring-danger/30"
      : "border-line-control focus:border-brand",
```

- [ ] **Step 5: Update card, alert and badge radii**

- `cardStyles`: `rounded-2xl` → `rounded-lg`.
- `components/ui/feedback.tsx`, the `Alert` wrapper: `rounded-xl` → `rounded-lg`.
- `badgeStyles` keeps `rounded-full` — badges are labels, not controls, and a pill is correct there.

Leave `Alert`'s role logic alone. It already sets `role="alert"` / `aria-live="assertive"` for the
danger tone and `status` / `polite` otherwise, which is correct — that is existing good work, not
something to "improve".

Then sweep for any other stale radius:

```bash
grep -rn "rounded-2xl\|rounded-3xl\|rounded-full" src/components src/pages | grep -v badge
```

Anything that is a control or a card moves to `rounded-md` / `rounded-lg`. Avatars and pure pills stay.

- [ ] **Step 6: Run the tests**

Run: `npx jest src/components/ui/styles.test.ts`
Expected: PASS.

- [ ] **Step 7: Check nothing broke**

Run: `npm test && npm run lint`
Expected: PASS. Any component asserting on `rounded-full` for a button needs updating — fix those call sites here, not later.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/styles.ts src/components/ui/styles.test.ts src/components/ui/button.tsx
git commit -m "feat(ui): new button/input recipes, 10px radius, emergency variant

Pill -> 10px across controls. Adds the SIGNAL register's only button: full
width, 56px tall, saturated danger fill, so it cannot be confused with an
ordinary action. Inputs move to --line-control, which clears 3:1; --line at
1.40:1 was never legal as a control border."
```

---

### Task 5: Form fields — visible labels, inline errors

**Files:**
- Modify: `src/components/ui/field.tsx`
- Test: `src/components/ui/field.test.tsx`

**Interfaces:**
- Consumes: `inputStyles` from Task 4.
- Produces: no API change. `Field`, `TextField`, `PasswordField`, `TextAreaField` keep their existing props. Error rendering gains an icon.

**Read this before writing a line.** `field.tsx` exports four things and they are not interchangeable:

| Export | Shape | Use |
|---|---|---|
| `Field` | **render-prop wrapper** — `children: (ids: { id, describedBy, invalid }) => ReactNode`. Props: `label`, `hint`, `error`, `required`, `hideLabel`, `className`. **No `name`, no `placeholder`.** | Wrapping a custom control |
| `TextField` | `label`, `hint`, `error`, `hideLabel`, `className`, `inputClassName` + native input props | The ordinary labelled text input |
| `PasswordField` | as `TextField`, minus `type` | Passwords |
| `TextAreaField` | `label`, `hint`, `error`, `className`, `textareaClassName` | Multi-line |

Tests and the gallery use **`TextField`**, not `Field`. Passing `name`/`placeholder` to `Field` is a type error.

- [ ] **Step 1: Read the current implementation first**

Run: `sed -n '1,120p' src/components/ui/field.tsx`

This task modifies rather than replaces. Match the existing prop names exactly — do not invent a new API.

- [ ] **Step 2: Write the failing test**

Create `src/components/ui/field.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { TextField } from "./field";

describe("TextField", () => {
  it("renders a visible label, never a placeholder standing in for one", () => {
    render(<TextField label="Building name" name="building" />);
    expect(screen.getByLabelText("Building name")).toBeInTheDocument();
  });

  it("ties the error to the input and marks it invalid", () => {
    render(<TextField label="Email" name="email" error="Enter a valid email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter a valid email")).toBeInTheDocument();
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      "Enter a valid email",
    );
  });

  it("pairs the error with an icon — colour alone never carries a state", () => {
    const { container } = render(
      <TextField label="Email" name="email" error="Enter a valid email" />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest src/components/ui/field.test.tsx`
Expected: FAIL on the icon assertion at minimum. If the label or `aria-describedby` assertions also fail, those are real defects to fix in Step 4.

- [ ] **Step 4: Update `field.tsx`**

Ensure the error element renders an icon beside the text:

```tsx
{error ? (
  <p
    id={errorId}
    // Icon + text, never colour alone: red and amber are 24.0 apart under
    // deuteranopia and 4.2 under tritanopia — effectively the same colour.
    className="mt-1.5 flex items-start gap-1.5 text-sm text-danger-text"
  >
    <XCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    <span>{error}</span>
  </p>
) : null}
```

Import `XCircleIcon` from `./icons`. Keep whatever `errorId` generation already exists; if there is none, derive it as `` `${id}-error` ``.

- [ ] **Step 5: Verify**

Run: `npx jest src/components/ui/field.test.tsx && npm test && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/field.tsx src/components/ui/field.test.tsx
git commit -m "feat(ui): form errors carry an icon and bind to their input

Red text alone cannot carry an error state — verified, red and amber separate
by 4.2 under tritanopia. Adds the icon, asserts the aria-describedby wiring."
```

---

### Task 6: ISO 7010 safety pictogram register

**Files:**
- Create: `src/components/ui/safetyIcons.tsx`
- Test: `src/components/ui/safetyIcons.test.tsx`

**Interfaces:**
- Produces: `EvacuateIcon`, `EmergencyExitIcon`, `AssemblyPointIcon`, `FireExtinguisherIcon`, `WarningIcon`, `MandatoryIcon` — each `(props: { size?: number; className?: string; title: string }) => JSX.Element`.
- **`title` is required, not optional.** These are never decorative; a safety pictogram with no accessible name is a defect.

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/safetyIcons.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import {
  EvacuateIcon,
  EmergencyExitIcon,
  AssemblyPointIcon,
  WarningIcon,
} from "./safetyIcons";

describe("ISO 7010 safety pictograms", () => {
  it("always carries an accessible name — these are never decorative", () => {
    render(<EvacuateIcon title="Evacuate now" />);
    expect(screen.getByRole("img", { name: "Evacuate now" })).toBeInTheDocument();
  });

  it("gives each severity a distinct geometry, so shape carries the meaning", () => {
    const { container: warn } = render(<WarningIcon title="Warning" />);
    const { container: exit } = render(<EmergencyExitIcon title="Exit" />);
    // Warning is the ISO triangle; exit is the ISO rectangle. If these ever
    // render the same outline, colour is doing all the work — which fails for
    // the ~8% of men with red-green colour vision deficiency.
    expect(warn.querySelector("polygon, path")).toBeTruthy();
    expect(warn.innerHTML).not.toEqual(exit.innerHTML);
  });

  it("renders at a size the caller controls", () => {
    const { container } = render(<AssemblyPointIcon title="Assembly point" size={48} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "48");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/components/ui/safetyIcons.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the register**

Create `src/components/ui/safetyIcons.tsx`:

```tsx
/* ============================================================================
   ISO 7010 safety pictograms — the SIGNAL register.
   ----------------------------------------------------------------------------
   Deliberately a separate module from icons.tsx. The UI icon set and the safety
   set must never be used interchangeably: an ISO 7010 running-man in a settings
   menu dilutes the signal, and a generic triangle in an evacuation banner fails
   ISO 23601, which requires conformant pictograms on evacuation plans.

   Geometry carries severity, because colour cannot: measured separation between
   the critical red and the warning amber is 24.0 under deuteranopia and 4.2
   under tritanopia — effectively identical. Triangle = warning, rectangle =
   safe condition, circle = mandatory, octagon = stop/critical.

   `title` is required. A safety pictogram without an accessible name is a bug.
   ========================================================================= */

export interface SafetyIconProps {
  /** Required — announced to assistive tech. Never omit on a safety symbol. */
  title: string;
  size?: number;
  className?: string;
}

const Svg = ({
  title,
  size = 24,
  className,
  children,
}: SafetyIconProps & { children: React.ReactNode }) => (
  <svg
    role="img"
    aria-label={title}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
  >
    <title>{title}</title>
    {children}
  </svg>
);

/** ISO 7010 E002 family — running figure through a door. Safe condition. */
export const EmergencyExitIcon = (p: SafetyIconProps) => (
  <Svg {...p}>
    <rect x="1" y="2" width="22" height="20" rx="1" fill="currentColor" opacity="0.12" />
    <path
      d="M14 3.5h6.5v17H14"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <circle cx="8" cy="6" r="1.6" fill="currentColor" />
    <path
      d="M8 8.5 6 13l2.5 2 .5 4M8 8.5l3 2 2.5-.5M6 13l-2.5 1.5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Critical / evacuate. Octagon — the one shape reserved for "stop now". */
export const EvacuateIcon = (p: SafetyIconProps) => (
  <Svg {...p}>
    <polygon
      points="8,1.5 16,1.5 22.5,8 22.5,16 16,22.5 8,22.5 1.5,16 1.5,8"
      fill="currentColor"
      opacity="0.12"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    <path
      d="M12 6.5v7"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
    />
    <circle cx="12" cy="17.25" r="1.25" fill="currentColor" />
  </Svg>
);

/** ISO 7010 W001 — general warning. Triangle. */
export const WarningIcon = (p: SafetyIconProps) => (
  <Svg {...p}>
    <polygon
      points="12,2 23,21 1,21"
      fill="currentColor"
      opacity="0.12"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    <path d="M12 9v5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    <circle cx="12" cy="17.5" r="1.15" fill="currentColor" />
  </Svg>
);

/** ISO 7010 M-series — mandatory action. Circle. */
export const MandatoryIcon = (p: SafetyIconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.12" />
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" />
    <path
      d="m7.5 12.25 3 3 6-6.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** ISO 7010 E007 — evacuation assembly point. Four arrows to a centre. */
export const AssemblyPointIcon = (p: SafetyIconProps) => (
  <Svg {...p}>
    <rect x="1" y="2" width="22" height="20" rx="1" fill="currentColor" opacity="0.12" />
    <path
      d="M12 12 6 6m0 0v3.5M6 6h3.5M12 12l6-6m0 0h-3.5M18 6v3.5M12 12l-6 6m0 0h3.5M6 18v-3.5M12 12l6 6m0 0v-3.5M18 18h-3.5"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** ISO 7010 F001 — fire extinguisher. Red register, fire equipment. */
export const FireExtinguisherIcon = (p: SafetyIconProps) => (
  <Svg {...p}>
    <rect x="1" y="2" width="22" height="20" rx="1" fill="currentColor" opacity="0.12" />
    <path
      d="M9.5 8.5h5v12h-5zM12 8.5V6.5M12 6.5h3.5l1.5 2M10 5.5h4"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/components/ui/safetyIcons.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/safetyIcons.tsx src/components/ui/safetyIcons.test.tsx
git commit -m "feat(ui): ISO 7010 safety pictogram register

Separate module from icons.tsx so the two registers cannot be mixed. Geometry
carries severity — triangle warning, octagon critical, rectangle safe, circle
mandatory — because colour cannot: red and amber separate by 4.2 under
tritanopia. title is a required prop; these are never decorative."
```

---

### Task 7: Rebuild the emergency banner on the SIGNAL register

**Files:**
- Modify: `src/components/emergency/EmergencyBanner.tsx`
- Test: `src/components/emergency/emergencyUi.test.tsx`

**Interfaces:**
- Consumes: `EvacuateIcon` from Task 6, `buttonStyles` from Task 4.
- Produces: `EmergencyBannerProps` unchanged.

- [ ] **Step 1: Write the failing test**

Append to `src/components/emergency/emergencyUi.test.tsx`:

```tsx
test("states the severity in words, not only in colour", () => {
  renderWithI18n(<EmergencyBanner />);
  const banner = screen.getByTestId("emergency-banner");
  expect(banner.textContent?.trim().length).toBeGreaterThan(0);
  expect(banner.querySelector("svg")).toBeTruthy();
});

test("never animates on a loop — WCAG 2.3.1, and flashing is not an option", () => {
  renderWithI18n(<EmergencyBanner />);
  const banner = screen.getByTestId("emergency-banner");
  expect(banner.className).not.toMatch(/animate-(pulse|ping|bounce)/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/components/emergency/emergencyUi.test.tsx`
Expected: the icon assertion may already pass; the loop assertion should pass too. **If both already pass, that is a valid result** — record it and move to Step 3 for the visual change only.

- [ ] **Step 3: Swap the icon to the safety register**

Replace the `AlertTriangleIcon` import with:

```tsx
import { EvacuateIcon } from "../ui/safetyIcons";
```

and the usage with:

```tsx
<EvacuateIcon className="size-5 shrink-0" title="" size={20} />
```

Pass `title=""` only because the adjacent text already names the state and the whole banner is `role="alert"`; if the banner ever loses its text, restore a real title.

- [ ] **Step 4: Verify**

Run: `npx jest src/components/emergency && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/emergency/EmergencyBanner.tsx src/components/emergency/emergencyUi.test.tsx
git commit -m "feat(emergency): banner uses the ISO 7010 pictogram register"
```

---

### Task 8: The `/_design` gallery — the review surface

**Files:**
- Create: `src/pages/other/designGallery.tsx`
- Modify: `src/App.tsx:222` area (route table)

**Interfaces:**
- Consumes: every recipe and component from Tasks 4–7.
- Produces: a route at `/_design`. Not linked from anywhere; discoverable only by URL.

- [ ] **Step 1: Build the gallery page**

Create `src/pages/other/designGallery.tsx`. It must render, in both light and dark:

1. The full graphite ramp as labelled swatches with their measured contrast against canvas.
2. The brand ramp, labelled, with a note saying which hue is currently active.
3. All four signal colours as solid fills with their correct ink, plus their subtle/text/border trio.
4. Every button variant × every size, including `disabled` and `loading`.
5. The `emergency` button at full width.
6. Inputs: default, focused, invalid-with-error, disabled, read-only.
7. Every badge tone, and every `Alert` tone from `components/ui/feedback.tsx`.
8. Cards, static and interactive.
9. Both icon registers side by side, labelled, with a line stating they must never be mixed.
10. The emergency banner.

```tsx
import { useState } from "react";
import {
  Button,
  TextField,
  Alert,
  badgeStyles,
  cardStyles,
} from "../../components/ui";
import {
  EvacuateIcon,
  EmergencyExitIcon,
  WarningIcon,
  MandatoryIcon,
  AssemblyPointIcon,
  FireExtinguisherIcon,
} from "../../components/ui/safetyIcons";

/* ============================================================================
   /_design — the design system, rendered.
   ----------------------------------------------------------------------------
   Not linked from the app and not in the sitemap. It exists so a change to a
   token can be seen against every component at once, instead of being noticed
   three pages later. Unlisted, not secret: nothing here touches data.
   ========================================================================= */

/* Named GallerySection, not Section: components/ui/layout.tsx already exports a
   `Section` and shadowing it here would confuse every future reader. */
const GallerySection = ({ title, note, children }: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) => (
  <section className="border-t border-line py-10">
    <h2 className="font-display text-2xl text-ink">{title}</h2>
    {note ? <p className="mt-1 max-w-2xl text-sm text-ink-muted">{note}</p> : null}
    <div className="mt-6">{children}</div>
  </section>
);

const Swatch = ({ token, label }: { token: string; label: string }) => (
  <div className="flex flex-col gap-1.5">
    <div
      className="h-14 w-full rounded-md border border-line"
      style={{ background: `var(${token})` }}
    />
    <code className="text-xs text-ink-muted">{label}</code>
  </div>
);

const DesignGallery = () => {
  const [invalid, setInvalid] = useState(true);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header>
        <h1 className="font-display text-4xl text-ink">AlertUp design system</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Two registers. Graphite carries the calm product; saturated colour is
          quarantined for emergencies, so colour arriving on screen is itself the
          alarm. Toggle the theme to check both.
        </p>
      </header>

      <GallerySection title="Chassis" note="Cool graphite. Never pure black — black grounds cause glare fatigue.">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {["--slate-0","--slate-50","--slate-100","--slate-200","--slate-300","--slate-400","--slate-500","--slate-600","--slate-700","--slate-800","--slate-900","--slate-950"].map((t) => (
            <Swatch key={t} token={t} label={t.replace("--", "")} />
          ))}
        </div>
      </GallerySection>

      <GallerySection title="Brand" note="Used at low surface area only: links, focus rings, one primary CTA. Never on map geometry or status.">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {["--brand-50","--brand-100","--brand-200","--brand-300","--brand-400","--brand-500","--brand-600","--brand-700","--brand-800","--brand-900","--brand-950"].map((t) => (
            <Swatch key={t} token={t} label={t.replace("--", "")} />
          ))}
        </div>
      </GallerySection>

      <GallerySection title="Signal — emergency only" note="ISO 3864 meanings, so the phone matches the wall. These four appear nowhere in the calm product.">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Critical / evacuate", "bg-danger text-danger-ink"],
            ["Safe / route / exit", "bg-success text-success-ink"],
            ["Warning / prepare", "bg-warning text-warning-ink"],
            ["Mandatory / instruction", "bg-info text-info-ink"],
          ].map(([label, cls]) => (
            <div key={label} className={`rounded-md p-4 text-sm font-semibold ${cls}`}>
              {label}
            </div>
          ))}
        </div>
      </GallerySection>

      <GallerySection title="Buttons" note="10px radius. Emergency is the only saturated fill and is always full width.">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="subtle">Subtle</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button variant="primary" loading>Loading</Button>
        </div>
        <div className="mt-6 max-w-md">
          <Button variant="emergency" size="xl">
            <EvacuateIcon title="" size={20} /> Evacuate now
          </Button>
        </div>
      </GallerySection>

      <GallerySection title="Inputs" note="Label always visible. Errors sit next to the field and carry an icon.">
        <div className="grid max-w-xl gap-5">
          <TextField
            label="Building name"
            name="gallery-name"
            placeholder="e.g. Tbilisi Mall"
          />
          <TextField
            label="Email"
            name="gallery-email"
            hint="Hint text sits below the label, above the error."
            error={invalid ? "Enter a valid email address" : undefined}
          />
          <Button variant="secondary" size="sm" onClick={() => setInvalid((v) => !v)}>
            Toggle error state
          </Button>
        </div>
      </GallerySection>

      <GallerySection title="Badges">
        <div className="flex flex-wrap gap-2">
          {(["neutral","brand","success","danger","warning","info"] as const).map((tone) => (
            <span key={tone} className={badgeStyles({ tone })}>{tone}</span>
          ))}
        </div>
      </GallerySection>

      <GallerySection title="Alerts" note="Inline, in-flow messages. Distinct from the emergency banner, which is role=alert and not dismissible.">
        <div className="grid gap-3">
          <Alert tone="info">Informational message.</Alert>
          <Alert tone="success">Something completed.</Alert>
          <Alert tone="warning">Something needs attention.</Alert>
          <Alert tone="danger">Something failed.</Alert>
        </div>
      </GallerySection>

      <GallerySection title="Cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={cardStyles({ className: "p-6" })}>
            <h3 className="font-medium text-ink">Static card</h3>
            <p className="mt-1 text-sm text-ink-muted">Hairline border carries the structure.</p>
          </div>
          <div className={cardStyles({ interactive: true, className: "p-6" })}>
            <h3 className="font-medium text-ink">Interactive card</h3>
            <p className="mt-1 text-sm text-ink-muted">Lifts on hover and on focus-within.</p>
          </div>
        </div>
      </GallerySection>

      <Section
        title="Icon registers"
        note="These two sets must never appear in the same component. An ISO 7010 running-man in a settings menu dilutes the signal; a generic triangle in an evacuation banner fails ISO 23601."
      >
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">SIGNAL — ISO 7010</h3>
            <div className="mt-3 flex flex-wrap gap-5 text-danger">
              <EvacuateIcon title="Evacuate" size={36} />
              <WarningIcon title="Warning" size={36} />
              <span className="text-success"><EmergencyExitIcon title="Emergency exit" size={36} /></span>
              <span className="text-success"><AssemblyPointIcon title="Assembly point" size={36} /></span>
              <span className="text-info"><MandatoryIcon title="Mandatory" size={36} /></span>
              <FireExtinguisherIcon title="Fire extinguisher" size={36} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">CALM — product UI</h3>
            <p className="mt-3 text-sm text-ink-muted">
              The existing set in <code>components/ui/icons.tsx</code> — 57 icons,
              24px grid, 1.75 stroke, <code>currentColor</code>.
            </p>
          </div>
        </div>
      </GallerySection>
    </main>
  );
};

export default DesignGallery;
```

- [ ] **Step 2: Register the route**

In `src/App.tsx`, add to the lazy imports:

```tsx
const DesignGallery = lazy(() => import("./pages/other/designGallery"));
```

and immediately **before** the catch-all `<Route path="*" .../>`:

```tsx
{/* Unlisted design system reference. Not in the nav, not in the sitemap. */}
<Route path="/_design" element={<DesignGallery />} />
```

- [ ] **Step 3: Confirm the SEO check does not index it**

Run: `npm run build`
Expected: PASS. If `scripts/check-seo.mjs` complains about a route with no metadata, add `/_design` to its ignore list rather than giving the page a `<Seo />` block — it must not be indexed.

- [ ] **Step 4: Look at it**

Open `http://localhost:5173/_design`. Check both themes with the theme toggle. Every swatch must render, no element may be invisible against its ground, and no horizontal scrollbar may appear at 375px width.

- [ ] **Step 5: Commit**

```bash
git add src/pages/other/designGallery.tsx src/App.tsx
git commit -m "feat(design): add /_design gallery

Unlisted route rendering every token and component state in both themes, so a
token change can be judged against the whole system at once."
```

---

## ⛔ CHECKPOINT — stop here

Do not start Pass 2 until the user has reviewed `http://localhost:5173/_design` and either approved or redirected.

Report to the user:
- What `/_design` shows, and the URL.
- Output of `npm test`, `npm run lint`, `npm run build`.
- Anything that looked wrong and was not in scope to fix.

---

# PASS 2 — Pages

### Task 9: Rebuild the home page

**Files:**
- Modify: `src/pages/home.tsx` (646 lines)

**Interfaces:**
- Consumes: everything from Pass 1.
- Produces: nothing other components import.

- [ ] **Step 1: Read the whole current file first**

Run: `cat src/pages/home.tsx`

Preserve: the `<Seo />` block, all `t()` i18n keys, the contact form wiring, the QR scanning section's behaviour, and the `.on-dark` hero treatment. **This is a visual rebuild, not a copy rewrite** — do not invent new marketing claims.

- [ ] **Step 2: Rebuild section by section, committing per section**

Apply, in order:
- Hero: keep `.on-dark`, restate the value proposition with the new type scale, one primary CTA, one secondary.
- Trust row: per the research, surface trust signals (logo walls, badges) no longer move enterprise buyers. Replace any badge row with a concrete standards statement — ISO 3864 / 7010 / 23601 alignment, WCAG 2.2 AA — which is a procurement claim, not an aesthetic one.
- Three pillars: keep the existing positioning order; restyle onto `cardStyles`.
- Emergency demo: this is the one place on the marketing site where SIGNAL colour is allowed, because it is showing the emergency product. Label it clearly as a demonstration.
- Contact: rebuild on the new `Field`.

- [ ] **Step 3: Verify at every breakpoint**

Check 375, 768, 1024, 1440px. No horizontal scroll at any width. Check both themes. Check Georgian — the longest Georgian strings must not overflow their buttons.

- [ ] **Step 4: Verify**

Run: `npm test && npm run lint && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/pages/home.tsx
git commit -m "feat(home): rebuild on the Instrument design system"
```

---

### Task 10: Rebuild the 404 page

**Files:**
- Modify: `src/pages/other/pageNotFound.tsx`

- [ ] **Step 1: Read the current file and App.tsx:44-52**

The comment there matters: legacy QR paths redirect rather than 404 because "404s during a fire is not an acceptable outcome." The 404 page inherits that reasoning — someone hitting it may have scanned a broken QR code while a building is being evacuated.

- [ ] **Step 2: Rebuild with a recovery path, not a joke**

Requirements:
- State plainly that the page does not exist.
- Offer three routed recoveries: scan a QR code, go to the dashboard, go home.
- If the app is in an active emergency, the 404 must still show the emergency banner — confirm the layout in `App.tsx` renders the banner above the route outlet, and if it does not, say so rather than duplicating it here.
- No SIGNAL colour. A missing page is not an emergency.

- [ ] **Step 3: Verify**

Run: `npm run build`, then visit `http://localhost:5173/this-does-not-exist` in both themes and both languages.

- [ ] **Step 4: Commit**

```bash
git add src/pages/other/pageNotFound.tsx
git commit -m "feat(404): rebuild with routed recovery paths"
```

---

### Task 11: Render both brand ramps and decide

**Files:**
- Modify: `src/styles/tokens.css` (brand block only)

- [ ] **Step 1: Screenshot the purple build**

With the purple ramp active, capture `/`, `/_design`, and `/this-does-not-exist` in light and dark. Save to `RESEARCHS/001-design-system-rebuild-2026-09/screens/purple/`.

- [ ] **Step 2: Swap to the navy ramp**

In `src/styles/tokens.css`, replace the eleven `--brand-*` values with the Civic navy alternate documented at the bottom of that file. Change nothing else.

- [ ] **Step 3: Re-run the contrast guard**

Run: `npx jest src/styles/tokens.contrast.test.ts`
Expected: PASS. If the navy ramp fails a pair, the ramp is wrong — fix the ramp, not the test.

- [ ] **Step 4: Screenshot the navy build**

Same six screens, to `RESEARCHS/001-design-system-rebuild-2026-09/screens/navy/`.

- [ ] **Step 5: Present both to the user and wait**

Do not pick. Show both sets, restate the tradeoff in two lines — purple is 67.7° from the nearest ISO safety hue and 32.7° from the competitor cluster; navy is 11.1° and 7.7° and closer to the Tbilisi corporate benchmark — and let the user choose.

- [ ] **Step 6: Apply the decision and commit**

```bash
git add src/styles/tokens.css
git commit -m "feat(design): adopt <chosen> as the AlertUp brand ramp"
```

---

## Out of scope for this plan

Named so nobody assumes they were forgotten:

- The remaining ~20 page areas (dashboard, buildings, map editor, settings, auth, legal, pricing, help). They re-skin automatically from the token swap but have not been individually reviewed. Queue them as a follow-up plan.
- ISO 23601 route colours in the 2D canvas and three.js layers. The tokens exist (Task 2) but wiring them into `components/map/` and `components/map3d/` is its own plan — it touches geometry, not styling.
- Removing the remaining raw hex literals (23 across the codebase, `#FF0000` first).
- Backend. Nothing in this plan touches `alertup_backend/`.

## Verification before claiming done

Never claim a task is complete without running and reading the output of:

```bash
npm run lint
npm test
npm run build
```

`npm run build` is the real gate — it runs `tsc -b`, the Vite build, the SEO generator and the SEO check. If any of the three fails, the task is not done. Report failures with their actual output rather than summarising them.
