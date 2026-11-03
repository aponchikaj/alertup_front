# 🚨 AlertUp — Frontend

Web app for AlertUp: indoor wayfinding with an emergency evacuation layer. Visitors scan a QR sticker and get a route (2D or 3D) to where they are going, or to the nearest safe exit during an emergency, with no app to install. Building owners draw their floors in a map editor, manage their team's roles, print QR codes, and trigger and follow emergencies live.

> ✍️ Built at approximately **age 15** (2025-2026)

---

## Stack

| | |
|---|---|
| Build | Vite, TypeScript |
| UI | React 18, Tailwind CSS 4, a small in-house design system (`src/components/ui`) |
| Routing | react-router 7 |
| Maps | SVG 2D renderer + three.js 3D view (lazy-loaded) |
| Realtime | Server-Sent Events with resume and a polling fallback; Socket.io for the map editor |
| i18n | English and Georgian (`src/i18n`, key parity enforced by a test) |
| HTTP | `fetch` wrapper in `src/apis/http.ts` (cookie session + Bearer fallback for Safari/iOS) |
| Tests | Jest + Testing Library |
| Hosting | Vercel |

## Run locally

```bash
nvm use                      # Node 26
npm ci
cp .env.example .env         # VITE_API_URL=http://localhost:3001 for a local backend
npm run dev                  # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run lint` | ESLint |
| `npm test` | Jest |
| `npm run build` | `tsc -b` + Vite build + SEO prerender and check (the verification build) |

Never commit `.env`: Vite bakes it into the bundle. Without `VITE_API_URL`, the API origin is picked from the hostname (`src/apis/apiBase.ts`).

## Layout

```
src/apis/         one module per backend area; http.ts, APIS.ts, apiBase.ts
src/components/   domain folders: ui, map, map3d, wayfinding, emergency, qr, ai, layout
src/pages/        one folder per route area
src/emergency/    emergency state machine + provider
src/auth/ guards/ session context and route guards
src/i18n/ seo/    translations; SEO metadata and prerender (see src/seo/README.md)
```

Architecture notes and known issues live in the workspace `docs/` folder (`docs/analysis/FRONTEND.md`, `docs/FIXES.md`).

## Related

Backend: [alertup_backend](https://github.com/aponchikaj/alertup_backend)

---

> 🇬🇪 Built in Tbilisi, Georgia by [Lazare Mirziashvili](https://github.com/aponchikaj)
