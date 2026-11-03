# AlertUp — Brand

Source of truth for colour, voice and visual identity. Tokens live in
`src/styles/tokens.css`; every pair there is checked by `src/styles/tokens.contrast.test.ts`.

## What AlertUp is

A zero-install, web-based indoor positioning and dynamic safety platform. It bridges commercial
indoor wayfinding with automated emergency routing, turning static building maps into real-time
interactive navigation.

**The insight the whole product rests on:** nobody downloads an app for a panic situation until it
is too late. So AlertUp earns its place through everyday use — finding a store, a restroom, a
parking spot — and the same QR/NFC touchpoints people already know instantly become the evacuation
system when a crisis triggers.

```
┌─────────────────────────────────────────────────────────┐
│                      ALERTUP ENGINE                     │
└────────────────────────────┬────────────────────────────┘
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [ Normal Operations ]             [ Crisis Triggered ]
  • Store & facility search         • Real-time fire/hazard map
  • Turn-by-turn wayfinding         • Active route redirects
  • Accessible route options        • Nearest safe emergency exit
```

**Markets:** shopping malls, hospitals, airports, university campuses, corporate hubs.
**Model:** annual B2B SaaS venue subscription (per m²) + turnkey NFC/QR hardware + analytics dashboard.

**Taglines**
- Navigate Everyday. Evacuate Instantly.
- Smart Wayfinding for Safer Spaces.
- Scan. Find. Safe.

## The colour system: two registers that never mix

| Register | Carries | Colour |
|---|---|---|
| **EVERYDAY** | Store search, wayfinding, the entire admin product. 99.9% of use. | Deep Slate Navy chassis + Signal Cyan accent |
| **EMERGENCY** | The crisis override, and nothing else. | High-Vis Safety Red |

Because Safety Red is absent from everyday use, **its arrival on screen is itself the alarm**. Cyan
never appears on an emergency surface; red never appears as decoration. Break that once and the
override stops reading as an override.

Verified: Signal Cyan and Safety Red separate by **166–271 RGB distance** after protan/deutan/tritan
simulation. A colour-blind user cannot mistake an everyday route for an evacuation route.

### Identity colours

| Role | Name | Hex | Usage |
|---|---|---|---|
| Primary base | Deep Slate Navy | `#0F172A` | Navigation headers, corporate branding, primary typography |
| Everyday accent | Signal Cyan | `#0284C7` | Active store routes, search bars, daily turn-by-turn paths |
| Emergency override | High-Vis Safety Red | `#DC2626` | Emergency banners, exit routes, panic highlights |
| Background neutral | Clean Off-White | `#F8FAFC` | High-contrast map canvas, reduces visual clutter |
| Muted UI | Border Charcoal | `#64748B` | Secondary text, floor selectors, inactive icons |

### Accessible working cuts

The identity hexes above are used **as specified** for logo, marketing and large display. Three of
them fail WCAG 2.2 AA in text-bearing roles, so the semantic tokens point at accessible neighbours
from the same ramp. This is not a change to the brand — it is the brand, made legible.

| Identity colour | Fails at | Working cut |
|---|---|---|
| Signal Cyan `#0284C7` | 4.10:1 behind a white label; 3.91:1 as link text | `#0369A1` (5.93:1 / 5.67:1) |
| Signal Cyan on navy | 4.36:1 | `#38BDF8` in dark mode (8.33:1) |
| Safety Red `#DC2626` on navy | 3.70:1 | `#F87171` in dark mode (6.45:1) |
| Border Charcoal `#64748B` on navy | 4.24:1 | `#94A3B8` (7.87:1) |

**Never** use a raw hex in a component. Consume the semantic tokens (`--brand`, `--ink`, `--danger`).

### Supporting signal colours

Not in the original spec; derived to follow ISO 3864 so the phone matches the signage on the wall.

| Meaning | ISO colour | Token |
|---|---|---|
| Safe condition, escape route, all clear | Green | `--success` |
| Warning, prepare | Yellow (**black label** — white on it is 1.98:1) | `--warning` |
| Mandatory action / instruction | Blue | `--info` |

### Map route colours

Everyday routes are Signal Cyan. Escape routes follow ISO 23601: horizontal routes light green,
vertical routes (stairs) dark green — the standard's own answer to multi-floor plans, which is this
product's hardest UI problem.

Cyan and green separate by only **35.4 under tritanopia**, so route *type* must also be carried by
line pattern, never colour alone: everyday solid, escape dashed, vertical double-dashed.

## Typography

| Role | Face | Weight |
|---|---|---|
| UI + body (Latin) | Inter Variable | 400 |
| UI + body (Georgian) | Noto Sans Georgian Variable | 400 |
| UI labels, buttons, nav | — | 500 |
| Headings | GL Tatishvili Metal (display) / Inter | 600, dropping to 550 in dark mode |

Three weights, deliberately. An audit found 121 uses of `font-semibold` against 64 of `font-medium`
— when everything is emphasised, nothing is. Hierarchy comes from size and space first, weight last.

Georgian needs its own handling: only ~5 Mkhedruli letters of ~40 sit at the x-height, so it takes
extra leading. Mtavruli capitals apply to a whole word minimum and read as ALL-CAPS SHOUTING, never
as Title Case — uppercase is disabled for `lang="ka"`.

## Logo directions

1. **The Dynamic Pin** — a location pin blended with a forward arrow and a subtle shield contour:
   destination and safety in one mark.
2. **The Signal Pulse** — an abstract `A` formed by two converging route paths pointing up toward a
   beacon light.

## Non-negotiables

- **Zero install.** Map loaded in the mobile browser within 1.5s of a tap or scan. No app store.
- **Contextual anchoring.** Every QR/NFC plate carries its spatial coordinates
  (`?point_id=MALL_FL2_ENTRANCE_B`), so the map anchors instantly with no indoor GPS calibration.
- **Crisis state is a full UI switch,** not a banner: high-contrast dark ground, bold directional
  arrows pointing only to safe exits.
- **No flashing, ever** (WCAG 2.3.1). Emergency attention comes from size, position, and colour
  arriving where colour never is.
- **Colour alone never carries a state.** Every state is also encoded in shape or text.
- **Nothing is hover-only.** Evacuation happens on a phone.
