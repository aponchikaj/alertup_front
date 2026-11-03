# AlertUp Slice 1: Foundations + Routing Quality — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `subagent-driven-development` (recommended) or `executing-plans` to implement task-by-task. Every task ends with its verification command green before the next starts. Tasks use `- [ ]` checkboxes.

**Goal:** Make the visitor route measurably better on the existing graph (metres + minutes, routing profiles, step-free with warnings, smoothed lines, turn-by-turn text in en/ka, alternative exits, live closures) and lay the foundations later slices need (zero lint errors, audit log, resumable realtime), with no paid services and no new non-permissive dependencies.

**Architecture:** Backend keeps the node/edge graph and Dijkstra but gains a pluggable time-based `costFn`, edge identity in the adjacency, per-request overlays (closures, profiles) that never mutate the shared cached graph, and pure modules for smoothing, instructions, safety field and alternatives. All API additions are additive on the existing `AssembledRoute` contract. Frontend consumes the new fields behind optional types, fixes 40 lint errors with real patterns (derive-in-render, `useLatestRef`, file splits), and hardens the SSE client with heartbeat/staleness/static fail-safe.

**Tech stack:** Express 5 + Prisma 6 + Postgres (Supabase) + SSE; Vite + React 18 + TS 5.9 + Tailwind 4 + Jest. **No new npm dependencies.** Frontend removes `framer-motion` and `ogl`.

**Spec:** this file (sections *Context*, *Locked decisions*, *Wire contract*). Research basis: `RESEARCHS/003-competitor-engineering-teardown-2026-09/05-SYNTHESIS-AND-BACKLOG.md` (themes A, B4–B6, D1–D4, H2–H3, J1–J2) and `03-STANDARDS-OSS-ALGORITHMS.md` §3–5. After approval, copy this file to `alertup_front/docs/superpowers/plans/2026-09-24-slice1-routing-quality.md` so it travels with the repo.

---

## Context

Research 003 (2026-09-24) tore down how Mappedin, MazeMap, Pointr, Situm, Esri Indoors, the evacuation-signage industry and the routing literature work, and produced a backlog of ~70 improved server-side capabilities. The founder chose **Slice 1: Foundations + routing quality** first; the emergency engine (Slice 2) and the Space/Opening data-model rebuild (Slice 3) follow and must not be blocked by this slice (all schema changes additive).

Problems today (code inventory 2026-09-24): routing costs are fixed pixel constants (stairs 400 / escalator 350 / elevator 300 stored into `Edge.weight` at write time); no ETA; no turn-by-turn text; closures require mutating the graph; no directed edges; `accessible=true` is all-or-nothing; routes zig-zag on generated lattices; the wayfinding panel never sends `accessible`; the scan endpoint never passes accessibility, duplicates emergency bookkeeping and never sets `ScanEvent.nodeId`; frontend ESLint has 40 errors blocking `merge-stage-to-preprod`; `POST /api/administration/logs/clear/:id` deletes non-emergency logs; SSE has no resume and the client cannot detect a dead stream.

Outcome: a scanned visitor sees a smoothed route with "120 m · 2 min", instructions like "Turn right after the pharmacy and walk 40 m" in English or Georgian, a working step-free option that warns "not step-free, 35 m from start", two alternative exits during an emergency, and an admin can close a corridor for two hours without touching the map. Lint is clean, every editor/emergency mutation is audited, and a dropped stream shows "connection lost, showing last known route" instead of a stale silent map.

## Locked decisions (founder, 2026-09-24)

1. First slice = Foundations + routing quality.
2. Build on top of the uncommitted work in both repos (backend AI-agents feature + its migration; frontend 12 unpushed commits + auditor panel). Commit together later through the `push` skill; stage only; never force-push.
3. Free: no new paid services; new deps only MIT/ISC/BSD/Apache (this plan adds none); single Node service.
4. Realtime: one Fly machine; harden it (resumable SSE, heartbeat seq, client fail-safe). LISTEN/NOTIFY deferred.

## Global constraints

- Backend responses use `ok(res,{message,data})` / `fail(res,status,message)` from `src/utils/respond.js`; permissions via `requirePermission(PERMISSIONS.X)` from `src/middlewares/requireBuildingPermission.js` (resolves `params.buildingId|id`, `body.buildingId`, `nodeId`, `floorId`, `edgeId` only, so nest closure routes under `/buildings/:buildingId/...`). Limiters from `src/services/rateLimiter.js`.
- Backend tests: `npm test` (Jest ESM, `TEST_DATABASE_URL` must be localhost, tables truncated after each test, `maxWorkers:1`). Helpers in `src/tests/helpers.js`. If the suite fails with constraint errors on a first run, re-run once (known dirty-DB flake) before investigating.
- Frontend: `PascalCase.tsx` components, `camelCase.ts` otherwise, tests next to code, `en.ts` typed source and `ka.ts` must mirror every key. `npm run lint && npm test && npm run build` must pass at the end of every milestone.
- `TransitType` stays `WALKWAY|ELEVATOR|ESCALATOR|STAIRS` (frontend has exhaustive `Record<TransitType,…>` maps).
- Printed QR slug `qr_{buildingId}_{floorNumber}_{nodeId}` immutable; legacy scan keys (`emergencyRoute`, `floorMap`, `allFloorNodes`, `routeNodes`, `floorTransitions`) untouched.
- `segments[].nodes` stays the node polyline; `steps[].segmentIndex/transitionIndex` and `transitions[].afterSegmentIndex` stay array indices; `segments[].floor` stays non-null with `id, floorNumber, width, height, scalePixelsPerMeter`.
- `dijkstra.test.js` asserts px costs for `shortestPath` with no options: default `costFn = e => e.cost`; time costs are opt-in via `profile`/`costFn`, and every HTTP route opts in.
- Unscaled floors: assume 50 px/m (matches `autoConnect.js` and `wayfinding.routes.js` comments), flag with `scaleAssumed:true` + `SCALE_ASSUMED` warning; `totalDistanceMeters` keeps today's null semantics.
- No `eslint-disable` for the new react-hooks v7 rules except a documented false positive.

## Wire contract (single source of truth for both repos)

Additive fields on `AssembledRoute` (backend `routeAssembler.js` → frontend `src/components/map/types.ts`):

| Where | New field | Type |
|---|---|---|
| route | `profile` | `'walk'\|'wheelchair'\|'elevator_first'\|'min_floor_changes'\|'emergency'` |
| route | `totalDistanceM`, `totalDurationSec` | `number` (assumed scale used where needed), `number` |
| route | `scaleAssumed`, `tagConstraintsRelaxed` | boolean |
| route | `warnings[]` | `{code, message, segmentIndex?, stepIndex?, transitionIndex?, distanceFromStartM?, floorIds?}` |
| route | `alternatives[]` (evacuation only) | `{exitNodeId, label, floorNumber, distanceM, durationSec, route}` (`route` is lean: no `floor.drawing`) |
| route | `instructions[]` | `{index, kind, distanceM, durationSec, segmentIndex, atNodeId?, at?{x,y}, landmark?{poiId,name,relation:'before'\|'after'\|'at',side:'left'\|'right'}, floorChange?{fromFloorNumber,toFloorNumber,transitType,direction}, stopIndex?, text:{en,ka}}`; `kind ∈ depart\|straight\|slight_left\|left\|sharp_left\|uturn\|slight_right\|right\|sharp_right\|transit\|arrive` |
| route | `closures[]` | `{id, floorId, reason, costMultiplier, startsAt, endsAt, blocked}` |
| route | `legs[]`, `stops[]` (multi-stop only) | `{index, toNodeId, poi, distanceM, durationSec, segmentIndex, nodeIndexInSegment}` |
| segment | `points[]`, `distanceM`, `durationSec`, `accessible`, `scaleAssumed` | `{x,y,nodeId?}[]`, number, number, boolean, boolean |
| transition | `edgeId`, `durationSec`, `accessible`, `level{from,to}` | string, number, boolean, ints |
| step | `distanceM`, `durationSec`, `distanceUntilM`, `timeUntilSec`, `accessible` | numbers, boolean |

Query params on `/api/wayfinding/route` and `/evacuate`: `profile=`, `accessible=true` (alias of `profile=wheelchair`), `includeTags=`/`excludeTags=` (comma or repeated), `heading=` (deg, integer 0–359), `src=sticker|kiosk|web|scan|ai`, `to` repeatable (≤ 8) and accepts `poi:<id>` | `ext:<code>` | nodeId. Scan `GET /api/qr/scan/route/:qrId` accepts `?profile=` and returns `route` (with the new fields), `alternatives`, `closures`, `profile`.

Closures: `GET|POST /api/map-editor/buildings/:buildingId/closures`, `PATCH|DELETE /api/map-editor/buildings/:buildingId/closures/:closureId` (CAN_EDIT_MAP). Public `GET /api/wayfinding/buildings/:buildingId/closures`. Body `{edgeIds[], nodeIds[], floorId?, costMultiplier: null|>=1, reason (≤200), startsAt?, endsAt?}`.

SSE: every frame carries `id: <seq>`; named `heartbeat` event `{seq, serverTime}` every 25 s (comment `: hb` kept); new `closure_changed` event `{closureId, action:'created'|'updated'|'deleted', blocked, edgeIds, nodeIds, reason, endsAt}`; resume via `Last-Event-ID` header **or** `?sinceSeq=<n>` (the client uses `?sinceSeq` on manual reconnects because browsers only send the header on their own auto-reconnect).

Map editor additions: Edge `direction BOTH|FORWARD|REVERSE`, `tags[]`, `rank PRIMARY|SECONDARY`, `visibility PUBLIC|STAFF|EMERGENCY_ONLY`, `lengthM?`; Node `visibility`, `externalId?`; Floor `verticalOrder?`, `shortName?`; Poi `externalId?`, `names {en?,ka?,aliases[]}`; `PUT/GET /api/map-editor/buildings/:buildingId/routing-profile`.

---

## Milestones (each ends deployable to stage.alertup.world)

- **M0 Foundations (~2 days):** F1 lint/dead code/console; B1 migration; B2 loader + costFn + cost model.
- **M1 ETA + profiles (~1 week):** B3–B6, F2–F5. Visible: distance + ETA, profile picker, step-free warnings, `ext:` codes.
- **M2 Closures, smoothing, exits, instructions (~1.5 weeks):** B7–B10, B15 (SSE), F6–F9, F11–F12.
- **M3 Search, multi-stop, analytics, audit, scan (~1 week):** B11–B14, B16–B17, F10, F13–F14.

Parallelism: backend and frontend tasks within a milestone are independent once the wire contract above is respected. Backend order: B1 → B2 → {B3, B6} → B4 → B5 → {B7, B8, B11} → {B9, B10, B13, B14} → B12 → B15 (can start after B1 + the queue from B11) → B16 → B17.

---

# Backend tasks (`/Users/l4zare/Desktop/folderebi/alertup/alertup_backend`)

### B1. Single additive migration

**Files:** modify `prisma/schema.prisma`; new migration `prisma/migrations/<ts>_slice1_routing_quality/` via `npx prisma migrate dev --name slice1_routing_quality`, then hand-append backfill SQL.

Schema additions (all nullable/defaulted):
```prisma
enum EdgeDirection { BOTH FORWARD REVERSE }
enum EdgeRank      { PRIMARY SECONDARY }
enum Visibility    { PUBLIC STAFF EMERGENCY_ONLY }
enum ActorType     { USER SYSTEM INTEGRATION }
Building += routingProfile Json?; closures Closure[]; routeRequests RouteRequest[]; searchEvents SearchEvent[]; realtimeEvents RealtimeEvent[]
Floor    += verticalOrder Int?; shortName String?
Node     += externalId String?; visibility Visibility @default(PUBLIC); @@unique([buildingId, externalId])
Poi      += buildingId String?; externalId String?; names Json?; searchText String?; @@unique([buildingId, externalId])
Edge     += lengthM Float?; direction EdgeDirection @default(BOTH); tags String[] @default([]); rank EdgeRank @default(PRIMARY); visibility Visibility @default(PUBLIC)
Log      += actorUserId String?; actorType ActorType @default(SYSTEM); entity String?; entityId String?; payload Json?; @@index([buildingId, entity, entityId])
model Closure      { id cuid; buildingId (Cascade); floorId String?; edgeIds String[] @default([]); nodeIds String[] @default([]); costMultiplier Float?; reason String?; startsAt DateTime @default(now()); endsAt DateTime?; createdById String?; createdAt; updatedAt; @@index([buildingId, endsAt]) }
model RouteRequest { id cuid; buildingId (Cascade); fromNodeId String?; to String?; profile String; mode String; src String?; found Boolean @default(true); distanceM Float?; durationSec Float?; createdAt; @@index([buildingId, createdAt(sort: Desc)]) }
model SearchEvent  { id String @id; buildingId (Cascade); query String; resultCount Int; pickedPoiId String?; createdAt; @@index([buildingId, createdAt(sort: Desc)]) }
model RealtimeEvent{ id cuid; buildingId (Cascade); seq BigInt; event String; data Json; createdAt; @@unique([buildingId, seq]); @@index([createdAt]) }
```
Appended SQL:
```sql
UPDATE "Poi" p SET "buildingId" = n."buildingId" FROM "Node" n WHERE n."id" = p."nodeId" AND p."buildingId" IS NULL;
UPDATE "Poi" SET "searchText" = lower("name" || ' ' || array_to_string("keywords", ' ')) WHERE "searchText" IS NULL;
-- optional later: CREATE EXTENSION pg_trgm; CREATE INDEX poi_searchtext_trgm ON "Poi" USING gin ("searchText" gin_trgm_ops);
```
- [ ] Tests `src/tests/schemaSlice1.test.js`: edge defaults are BOTH/PRIMARY/PUBLIC with empty tags; poi externalId unique per building, reusable across buildings; Closure + RealtimeEvent round-trip (null costMultiplier, `typeof seq === 'bigint'`).
- [ ] Verify: `npx prisma validate && npx prisma migrate dev --name slice1_routing_quality && npm test -- src/tests/schemaSlice1.test.js`

### B2. Graph loader with edge identity, `costFn` in Dijkstra, cost model

**Files:** modify `src/features/wayfinding/graphService.js`, `src/features/wayfinding/dijkstra.js`, `src/tests/helpers.js` (`connectNodes` passes `direction, tags, rank, visibility, lengthM`; `createNode` passes `visibility, externalId`); create `src/features/wayfinding/costModel.js`, `src/tests/graphFixtures.js` (extract `buildGraph` from `dijkstra.test.js`, extended with `edgeId, lengthM, radj, direction`).

`graphService.loadBuildingGraph(buildingId)` returns `{ buildingId, nodes, adj, radj, floors, edgesById, routingProfile, unscaledFloorIds:Set, loadedAt }`; node += `visibility, externalId, level: floor.verticalOrder ?? floor.floorNumber`; floor += `verticalOrder, shortName`; adj entry `{ edgeId, to, cost /*legacy weight*/, distance, lengthM, lengthMAssumed, transitType, accessible, direction, tags, rank, visibility, forward }`. Expansion: BOTH both ways, FORWARD source→target only, REVERSE target→source only; every pushed `adj[a]→b` mirrored into `radj[b]`. `lengthM` order: `edge.lengthM` → same-floor manual weight `weight/scale` → `distance/scalePixelsPerMeter` → `distance/ASSUMED_PIXELS_PER_METER(50)` with `lengthMAssumed:true`; cross-floor `null`. Fourth query loads `building.routingProfile`.

`dijkstra.shortestPath(graph, startId, { targetId, targetPredicate, edgeFilter, costFn = null, excludeNodeIds = null })`; `costFn(edge, fromNode, toNode)` returning `Infinity`/`NaN` skips the edge; `excludeNodeIds` never expanded nor targeted (start exempt). `findRoute(graph,start,target,{accessible,profile,costFn,edgeFilter,excludeNodeIds})`, `findEvacuationRoute(graph,start,{accessible,profile,costFn,edgeFilter,excludeExitIds=[],targetPredicate})` return `{path,cost,accessibleRouteUnavailable,exitNodeId?}`; when `profile` given and no `costFn`, `costFn = makeCostFn(profile)`. `DEFAULT_TRANSIT_COST` stays exported for `edgeService.computeEdgeGeometry`.

`costModel.js` (pure): `DEFAULT_ROUTING_PROFILE = { walkSpeedMps:1.4, stairsSpeedMps:0.5, escalatorSpeedMps:0.5, stairsRunMPerFloor:8, escalatorRunMPerFloor:8, escalatorEntrySec:3, elevatorWaitSec:30, elevatorPerFloorSec:5, elevatorEvacuationRated:false, secondaryRankMultiplier:1.5, northOffsetDeg:0 }`; `PROFILE_NAMES`; `validateRoutingProfile(json)`; `resolveProfile(buildingJson, name='walk')` applying named modifiers (elevator_first: `transitMultiplier {STAIRS:3, ESCALATOR:2}`; min_floor_changes: `floorChangePenaltySec:600`; emergency: `blockedTransit: elevatorEvacuationRated ? [] : ['ELEVATOR']`; wheelchair: `requireAccessible:true`); `edgeDurationSec(edge, from, to, profile)` (WALKWAY `lengthM/walkSpeedMps`; STAIRS `stairsRunMPerFloor×Δ/stairsSpeedMps`; ESCALATOR `escalatorEntrySec + escalatorRunMPerFloor×Δ/escalatorSpeedMps`; ELEVATOR `elevatorWaitSec + elevatorPerFloorSec×Δ`; + `floorChangePenaltySec` on cross-floor; × `transitMultiplier[type]`; Infinity when blocked); `makeCostFn(profile)` multiplies by `secondaryRankMultiplier` for SECONDARY; `floorDelta(from,to)` = `|from.level−to.level|` min 1.

- [ ] Tests: `costModel.test.js` (walkway = lengthM/speed; elevator wait + per-floor × verticalOrder delta; emergency makes elevators Infinity unless rated; overrides win, unknown keys rejected). `dijkstra.test.js` extend (costFn overrides and Infinity prunes; excludeNodeIds; FORWARD one-way). `src/tests/graphService.test.js` (edgeId + radj mirror; REVERSE only in adj[target]; 50 px/m fallback flags floor; manual same-floor weight becomes lengthM).
- [ ] Verify: `npm test -- src/features/wayfinding src/tests/graphService.test.js`

### B3. Profiles, tags, visibility filters (pure)

**Files:** create `src/features/wayfinding/profiles.js`.
`parseRoutingQuery(query) → { ok, name, includeTags, excludeTags, heading|null, src, error }` (`accessible=true` → `wheelchair`; unknown profile → 400); `buildRoutingContext(graph, { name, includeTags, excludeTags, audience='public', overlay=null }) → { name, profile, costFn, edgeFilter, strictEdgeFilter, fallbacks:[{label, edgeFilter, costFn}] }`; `visibilityAllowed(visibility,{name,audience})` (PUBLIC always; EMERGENCY_ONLY when name==='emergency'; STAFF when audience==='staff'); `composeFilters(...)`. Node visibility checked on `graph.nodes.get(edge.to)`. Fallback chain: strict → relax tags (`tagConstraintsRelaxed`) → relax accessibility (`accessibleRouteUnavailable`). Visibility never relaxed. Overlay from B7 folded into `costFn`/`edgeFilter` so fallbacks respect closures.
- [ ] Tests `profiles.test.js`: accessible alias; public walk refuses EMERGENCY_ONLY, emergency includes; excludeTags then fallback order; unknown profile 400.
- [ ] Verify: `npm test -- src/features/wayfinding/profiles.test.js`

### B4. `routeAssembler` v2: ETA, cumulative fields, per-step accessibility, warnings

**Files:** modify `src/features/wayfinding/routeAssembler.js`.
`assembleRoute(graph, pathIds, { mode, destinationPoi, accessible, accessibleRouteUnavailable, profile=null, profileName='walk', tagConstraintsRelaxed=false, overlay=null, lean=false })`; export `pathEdges(graph, pathIds) → [{edge, from, to}]`. Adds the route/segment/transition/step fields from the wire contract (`totalDistanceM`, `totalDurationSec`, `scaleAssumed`, `warnings`, `tagConstraintsRelaxed`; segment `distanceM`, `durationSec`, `accessible`, `scaleAssumed`; transition `edgeId`, `durationSec`, `accessible`, `level`; step `distanceM`, `durationSec`, `distanceUntilM`, `timeUntilSec`, `accessible`). Wheelchair fallback emits `INACCESSIBLE_STEP` warnings with `segmentIndex`, `stepIndex`, `distanceFromStartM`. Legacy callers without `profile` get `resolveProfile(graph.routingProfile,'walk')`. `lean` omits `floor.drawing`/`svgContent`.
- [ ] Tests `routeAssembler.test.js` extend: cumulative fields sum to totals; escalator transition duration follows profile and marks step inaccessible; wheelchair fallback annotates metres from start; unscaled floor sets scaleAssumed + warning while `distanceMeters` stays null. Existing four tests unchanged.
- [ ] Verify: `npm test -- src/features/wayfinding/routeAssembler.test.js`

### B5. Route API wiring: profiles, tags, `ext:`, verticalOrder

**Files:** modify `src/features/wayfinding/wayfinding.routes.js`; create `src/features/wayfinding/destinations.js` (`resolveDestination(buildingId, raw)` for nodeId | `poi:<id>` | `ext:<code>` (Poi.externalId then Node.externalId); `parseDestinations(query)` ≤ 8).
Handler flow: `parseRoutingQuery` → origin lookup → `getGraph` → `getActiveClosures` (stub `[]` until B7) → `buildRoutingContext` → strict then fallbacks → `assembleRoute` → `recordRouteRequest` (stub until B13) → `ok(res,{data:{route, closures}})`. `/evacuate` uses `emergency` unless `profile=wheelchair` (then wheelchair filters on top of emergency's `blockedTransit`). Directory/POI search add `externalId`, `shortName`, `verticalOrder`.
- [ ] Tests in `src/tests/featureRoutes.test.js` (extend, `seedMall`): durationSec + profile present and `totalDistanceMeters === 30` unchanged; `to=ext:` resolves inside the building only; `profile=min_floor_changes` prefers same-floor exit; `excludeTags=service` falls back with `tagConstraintsRelaxed`; EMERGENCY_ONLY edge invisible to walk, used by evacuate.
- [ ] Verify: `npm test -- src/tests/featureRoutes.test.js`

### B6. Editor write paths for new fields + validation on directed graphs

**Files:** modify `src/features/mapEditor/mapEditor.routes.js`, `edgeService.js` (`createEdge` accepts `direction, tags, rank, visibility, lengthM`), `graphValidation.js` (exit-reachability BFS over `graph.radj`, fallback `adj`; new issue `EDGE_ONE_WAY_DEAD_END` warning); create `src/features/mapEditor/fieldValidators.js` (`parseTags` ≤ 20 lowercase, `parseDirection`, `parseRank`, `parseVisibility`, `parseExternalId` ≤ 64, `parsePoiNames`, `buildSearchText`).
Routes: POST/PATCH edges accept the five fields (`lengthM:null` resets); PATCH node accepts `visibility`, `externalId` (P2002 → 409); floors accept `verticalOrder` (Int, may be negative), `shortName` ≤ 16; POI PUT accepts `externalId`, `names{en,ka,aliases}` and sets `buildingId`, `searchText`; `PUT/GET /api/map-editor/buildings/:buildingId/routing-profile` validated by `validateRoutingProfile`. Every write still calls `invalidate(buildingId)`.
- [ ] Tests: featureRoutes (edge PATCH stores all fields, null lengthM resets; node externalId conflict 409; POI names populate searchText); `graphValidation.test.js` (one-way dead end flagged).
- [ ] Verify: `npm test -- src/tests/featureRoutes.test.js src/features/mapEditor`

### B7. Route-time closures

**Decision:** closures cached separately from the graph (15 s TTL + `invalidateClosures` on write) because they change on incident cadence and "active" depends on `now`.
**Files:** create `src/features/wayfinding/closures.js` (`getActiveClosures(buildingId, now)`, `invalidateClosures`, `buildOverlay(closures, graph) → { edgeMultiplier:Map, blockedEdgeIds:Set, blockedNodeIds:Set, fingerprint }` (nodeIds → all touching entries; floorId with no ids → all edges with both ends on the floor), `applyOverlay(ctx, overlay, { originId })` (origin never blocked), `publicClosure(row)`); create `src/features/mapEditor/closure.routes.js` (mount in `server.js` after `mapEditorRouter`); modify `wayfinding.routes.js`, `profiles.js`, `routeAssembler.js` (`CLOSURE_ON_ROUTE` warning when a multiplier closure lies on the path).
Routes per wire contract; validation: ids belong to the building, `costMultiplier` null or ≥ 1, `endsAt > startsAt`, `reason ≤ 200`; each write in `$transaction` (+ audit row from B14) → `invalidateClosures` → `publish(buildingId,'closure_changed',{closureId, action, blocked, edgeIds, nodeIds, reason, endsAt})`. Public list route with `publicReadLimiter`. `/route`, `/evacuate`, scan include `closures`.
- [ ] Tests `src/tests/closures.test.js`: blocked closure on the only corridor → 404, multiplier → detour; node closure blocks touching edges except origin; CRUD gated, publishes `closure_changed` (capture via `subscribe`), appears on public list only while active; expired closure ignored without flush.
- [ ] Verify: `npm test -- src/tests/closures.test.js src/tests/featureRoutes.test.js`

### B8. Any-angle smoothing + rank

**Files:** create `src/features/wayfinding/smoothing.js` (`lineOfSight(ax,ay,bx,by,walls)` via `autoConnect.segmentsIntersect`; `smoothPolyline(nodes, walls, {isProtected})` greedy farthest-visible; `smoothSegment(segmentNodes, floor) → { points:[{x,y,nodeId?}], smoothed }`, unsmoothed when the floor drawing has no `wall`/`outline` shapes); modify `routeAssembler.js` to set `segments[].points`. Protected: first, last, TRANSIT/EMERGENCY_EXIT/POI/ENTRANCE, `hasPoi`. Distances stay node-based (document in module header); `points` drive drawing and instruction distances.
- [ ] Tests `smoothing.test.js`: zig-zag lattice collapses to two points; wall keeps the corner; transit/POI never dropped; image-only floor unsmoothed.
- [ ] Verify: `npm test -- src/features/wayfinding/smoothing.test.js src/features/wayfinding/routeAssembler.test.js`

### B9. Distance-to-safety field + alternative exits

**Files:** create `src/features/wayfinding/safetyField.js` (`computeSafetyField(graph,{costFn,edgeFilter})` multi-source over `radj` from all EMERGENCY_EXIT nodes → `{distTo, nextHop, exitFor, computedAt}`; `getSafetyField(graph, ctx, {fingerprint})` cached in `WeakMap<graph, Map<key,field>>` max 8 keys; `pathFromField(field, startId)`); create `alternatives.js` (`alternativeExits(graph, startId, ctx, {primaryExitId, max=2})` via growing `excludeExitIds`); modify `dijkstra.js`, `wayfinding.routes.js`. `/evacuate` primary via field, wheelchair strict/fallback via Dijkstra; `alternatives[]` with lean routes.
- [ ] Tests `safetyField.test.js` (field equals shortestPath cost on a directed fixture; pathFromField reproduces path; cached per graph object, dropped on reload); featureRoutes (evacuate returns two alternatives with different exits ordered by durationSec).
- [ ] Verify: `npm test -- src/features/wayfinding/safetyField.test.js src/tests/featureRoutes.test.js`

### B10. Turn-by-turn instructions v1 (en/ka) + heading

**Files:** create `src/features/wayfinding/instructions.js` (`TURN_TABLE` Valhalla bands; `classifyTurn(deltaDeg)`; `bearing(p,q)` map-space 0 = up, clockwise; `douglasPeucker(points, epsPx)`; `pickLandmark(turnPoint, prevPoint, pois, walls, {radiusPx, side})` score = categoryWeight × unique × sideMatch × (LOS ? 1 : 0.3), category weights door/entrance 1.0, elevator/stairs/escalator 0.9, wc 0.8, shop/poi 0.7, info 0.5; `buildInstructions(route, graph, {profile, heading, scaleFor})`); create `instructionText.js` (`TEMPLATES.{en,ka}` keys depart, depart_heading, straight, slight, turn, sharp, uturn, transit_up, transit_down, arrive, arrive_side, rel_before/after/at, side_left/right, transit_STAIRS/ELEVATOR/ESCALATOR; `render(locale,key,vars)` `{a}` interpolation; `formatDistance(m)` <10 → 1 m steps else nearest 5); modify `routeAssembler.js` (`instructions`), `wayfinding.routes.js` (`heading`).
Rules: eps 0.4 m × px/m; decisions < 3 m merge; `straight` only as confirmation past a unique landmark on legs > 25 m; `depart` phrased against `heading − profile.northOffsetDeg` when heading given; `arrive` side by cross product. Georgian strings flagged for native review in the PR (the founder is a native speaker).
- [ ] Tests `instructions.test.js`: every band boundary (10/11, 44/45, 135/136, 159/160, 200/201, 224/225, 315/316, 349/350); L-corridor → depart, right, arrive with distances summing; landmark on turn side beats closer wrong-side; heading phrases first instruction, en/ka non-empty; two decisions 2 m apart merge.
- [ ] Verify: `npm test -- src/features/wayfinding/instructions.test.js src/features/wayfinding/routeAssembler.test.js`

### B11. Search aliases + missed-search log + analytics queue

**Files:** create `src/services/analyticsQueue.js` (`enqueue(label, fn)` never throws, tracked Set; `drain()` for tests); modify `wayfinding.routes.js` (`/pois` OR over `searchText contains lower(q)` and `name insensitive`; response adds `searchId` (randomUUID), `names`, `externalId`; after responding enqueue `searchEvent.create` when q non-empty); new `POST /api/wayfinding/search-events/:searchId/pick {poiId}` (`publicReadLimiter`, UUID regex; `updateMany` scoped to the POI's building).
- [ ] Tests: featureRoutes (Georgian alias match); `src/tests/searchEvents.test.js` (zero-result query logged after drain; pick only for same-building POI).
- [ ] Verify: `npm test -- src/tests/searchEvents.test.js src/tests/featureRoutes.test.js`

### B12. Multi-stop routing

**Files:** create `src/features/wayfinding/multiStop.js` (`orderStops(costMatrix,{fixedStart})` NN + 2-opt open tour; `planMultiStop(graph, fromId, targetIds, ctx)` ≤ 9 shortestPath runs → `{path, order, legs}` or which leg failed); modify `wayfinding.routes.js` (`legs[]`, `stops[]`; > 8 targets → 422; `instructions` get an `arrive` with `stopIndex` per stop; single `to` shape identical).

**Ordering cost — ruling, 2026-09-25.** The stop-ordering cost matrix is built from a geometric proxy (straight-line distance plus a floor-change penalty scaled to the floor's pixels-per-metre), NOT from the routing context's `costFn`. A true matrix costs n(n−1) = 72 Dijkstras at 9 nodes on a public unauthenticated endpoint, which is exactly what the run budget exists to prevent. Every LEG still uses the context's `costFn` and `edgeFilter`, so closures, tags and visibility are always honoured and the returned route is always correct; under an active closure the visiting ORDER may be optimised against a walk the visitor will not take. That is the accepted trade — the budget wins over optimal ordering. **Worst-case request cost:** 3 fallback attempts × 8 legs = 24 `shortestPath` runs, not the per-plan 8.
- [ ] Tests `multiStop.test.js` (2-opt fixes crossed NN order on a square); featureRoutes (single `to` has no `legs`; `to=a&to=b` legs in optimised order; unreachable stop → 404 naming it).
- [ ] Verify: `npm test -- src/features/wayfinding/multiStop.test.js src/tests/featureRoutes.test.js`

### B13. `RouteRequest` analytics events

**Files:** create `src/features/wayfinding/routeRequests.js` (`recordRouteRequest({buildingId, fromNodeId, to, profile, mode, src, found, distanceM, durationSec})` via `enqueue`); call from `wayfinding.routes.js`, `scan.js` (B16), `src/features/ai/agents/tools/wayfindingTools.js` (`src:'ai'`). `src` whitelist default `web`.
- [ ] Tests `src/tests/routeRequests.test.js`: route call writes one row after drain; 404 writes `found:false`; failing insert (spy reject) leaves the response unaffected.
- [ ] Verify: `npm test -- src/tests/routeRequests.test.js`

### B14. Audit rows in the same transaction + `logs/clear` fix

**Files:** create `src/services/audit.js` (`actorFromReq(req)`; `writeAudit(tx, {buildingId, actorUserId, actorType, entity, entityId, action, payload, type='SYSTEM', isEmergency=false})`, message `${entity}.${action}`, payload truncated to 8 KB); modify `mapEditor.routes.js` (each write wrapped in `prisma.$transaction(async tx => …)`), `closure.routes.js`, `emergencyService.js` (`triggerEmergency` gains `actorType`; `resolveEmergency(buildingId,{userId})`; `recordAction(buildingId, action, {message, nodeId})`), `emergency.routes.js` (pass userId), `src/routes/administration.js:240` (`where: { buildingId, isEmergency: true }`), `src/routes/nodes.js`.
- [ ] Tests `src/tests/audit.test.js`: edge create writes `edge.create` row with actor + payload; duplicate externalId write leaves no audit row (rollback); trigger/resolve carry actorUserId + entityId; logs/clear removes emergency logs, keeps audit rows.
- [ ] Verify: `npm test -- src/tests/audit.test.js src/tests/featureRoutes.test.js`

### B15. Resumable SSE: event log, `Last-Event-ID`/`?sinceSeq`, named heartbeat, purge, limiter

**Decision:** emit first with an in-memory monotonic seq (`Math.max(lastSeq+1, Date.now())`), persist asynchronously through the queue; a lost persist only degrades replay; the `state` snapshot on connect plus `heartbeat.seq` gaps self-heal.
**Files:** create `src/features/realtime/eventLog.js` (`nextSeq()`, `append(buildingId, seq, event, data)`, `replaySince(buildingId, sinceSeq, {limit=500})` → `[{seq:Number, event, data}]`, `REALTIME_EVENT_RETENTION_MS = 24h`, `purgeOlderThan(ms)`); modify `broadcaster.js` (`publish` allocates seq, emits `{event, data, seq}`, calls `append`), `sseHelpers.js` (`sendEvent(res, event, data, {id})` writes `id:`; `startHeartbeat(res, intervalMs, {getSeq})` writes `: hb` + `event: heartbeat` `{seq, serverTime}`), `realtime.routes.js` (after `state`, read `req.get('Last-Event-ID') ?? req.query.sinceSeq`, replay with `id`, honour `includeLogs` filter, then live with `id`), `src/services/rateLimiter.js` (`sseConnectLimiter` 300/min on the public status route), `src/jobs/sweeper.js` (`purgeOlderThan()`), `src/features/realtime/broadcaster.test.js` (one `toEqual` → `toMatchObject`).
- [ ] Tests `src/tests/realtimeResume.test.js` (+ `sweeperRetention.test.js`): publish persists monotonic seq after drain; `Last-Event-ID` and `?sinceSeq` replay only later events for that building; every live frame has `id`, heartbeat has `seq` + `serverTime`; sweeper purges > 24 h; broadcaster delivers synchronously with seq.
- [ ] Verify: `npm test -- src/tests/realtimeResume.test.js src/features/realtime src/tests/sweeperRetention.test.js`

### B16. Scan endpoint integration + AI tool pass-through

**Files:** modify `src/routes/qr/scan.js` (replace lines 201–221 with `recordAction(buildingId,'scanned',{message, nodeId})` in try/catch; `ScanEvent.create` sets `nodeId`; `parseRoutingQuery`; profile `wheelchair` when requested else `emergency`; closures → overlay → safety field → `assembleRoute` with instructions → `alternativeExits`; response adds `route` (new fields), `alternatives`, `closures`, `profile`; legacy keys and `emergencyRoute.distance` (hop count) untouched; `recordRouteRequest({mode:'EVACUATION', src:'scan'})`), `src/features/ai/agents/tools/wayfindingTools.js` and `src/features/ai/evacuationBrief.routes.js` (pass `profile`; `summarizeRoute` adds `durationSec`).
- [ ] Tests `src/tests/scanRoute.test.js` (existing six untouched; add): scan during emergency publishes `counters_updated` and stores `ScanEvent.nodeId`; `?profile=wheelchair` returns fallback with warnings and legacy `emergencyRoute` intact; response lists alternatives + active closures.
- [ ] Verify: `npm test -- src/tests/scanRoute.test.js src/tests/wayfindingTools.test.js src/tests/evacuationBrief.test.js`

### B17. Full regression + contract test

- [ ] Create `src/tests/routeContract.test.js`: route payload is a superset of the pre-slice `AssembledRoute` keys per segment/transition/step; `steps[].kind ∈ walk|transit|arrive`; no `transitType` outside the four values.
- [ ] Verify: `npm test` twice (order stability) `&& npx prisma validate`; manual smoke `curl "localhost:3001/api/wayfinding/route?from=<id>&to=ext:<code>&profile=wheelchair&heading=90"` and `curl -H "Last-Event-ID: 0" localhost:3001/api/realtime/buildings/<id>/status`.

---

# Frontend tasks (`/Users/l4zare/Desktop/folderebi/alertup/alertup_front`)

### F1. Lint to zero errors, dead code, console leaks (blocks promotion)

Rule semantics: `react-hooks/set-state-in-effect` flags any setState reachable synchronously from an effect body (including via a local helper); `.then`/post-`await`/subscription callbacks are fine. `react-hooks/refs` flags `ref.current` reads/writes during render. `react-refresh/only-export-components` flags non-component exports in a `.tsx` that also exports a component. **Re-run `npm run lint` after every file** (fixing one error can un-bail the compiler and surface siblings).

- [ ] **Dead files/deps** (zero importers verified): delete `src/components/qr/SvgUploader.tsx`, `src/apis/uploadApi.ts`, `src/components/ui/lightRays.tsx` (reword the comment in `src/components/map3d/mapScene.ts:7`), `src/components/ui/languageToggle.tsx`, `src/components/layout/PageHeader.tsx`; `npm uninstall framer-motion ogl`.
- [ ] **File splits** for `only-export-components`: `src/auth/authContext.ts` (`AuthContext` + types; repoint `AuthProvider.tsx`, `useAuth.ts`); `src/emergency/emergencyContext.ts` (repoint `useEmergency.ts`); `src/components/ui/toastContext.ts` (`ToastContext`, `useToast`; repoint `ui/index.ts`, `pages/buildings/members.tsx:48`, `mapEditor/mapEditorPage.tsx:51`, `pages/invite/inviteAccept.tsx:18`, and any `jest.mock('.../toast')` in their tests); `src/components/wayfinding/storedDestination.ts` (`StoredDestination`, `readStoredDestination`, `writeStoredDestination`); `src/seo/applySeo.ts` (`MANAGED_ATTR`, `createMeta`, `applySeo`, `ResolvedSeo`).
- [ ] **set-state-in-effect real fixes:** `AuthProvider.tsx:123` split `applyResult(result, seq)` from `refresh()`, mount effect runs `getAuthState().then(...)` only; `Navbar.tsx:140` derive-on-prop-change (`lastPath` state compared in render) and move `isClosingRef.current = false` into the drawer effect; `EmergencyProvider.tsx:91` make `realtime.onStatusChange(cb)` invoke `cb(currentStatus)` immediately and drop the direct `setConnection`; `buildingOwnerGuard.tsx:65` and `permissionGuard.tsx:95` derive `status`/`fallback` in render from a keyed result state, effects only kick off promises.
- [ ] **refs:** create `src/lib/useLatestRef.ts` (`useRef` + `useLayoutEffect` assign); use in `useAiChat.ts:44`, `MapCanvas.tsx:95,97`, `useMapCamera.ts:103–111`, and proactively `WayfindingPanel.tsx:209`.
- [ ] **no-explicit-any:** guards `children: ReactNode`; `mybuildings.tsx:59`, `loading.tsx:42` `catch (err: unknown)` + `errorMessage(err, ...)`; `settings.tsx` typed `UserSettings` interface (confirm against `src/apis/settings.ts` `getSettings` shape), typed `getSettings(): Promise<ApiResponse>`, untyped `(e) =>` handlers infer from `BaseInputProps`.
- [ ] **Seo warnings:** `keywordsKey`/`jsonLdKey` = `JSON.stringify(...)` outside the effect, listed as deps.
- [ ] **Console leaks:** remove every `console.log` (`register.tsx:67` logs the plaintext password, `:88`; `settings.tsx:118,130,262`; `emergencyAnalytics.tsx:59,86`; `mybuildings.tsx:98`; `floor.tsx:49`; `logs.tsx:31`) and the `console.error/warn` in `login.tsx:87,118`, `mybuildings.tsx:84,105`, `floor.tsx:78`, `loading.tsx:43`, `buildingOwnerGuard.tsx:53`, `qrScanRoutePage.tsx:418`, `scan.tsx:36`, `Scanner.tsx:74,90`, `routeApi.ts:75`, `connect.ts:15`, `building.ts:9,19,29,39` (apis must rethrow or return an error envelope, never swallow); add `'no-console': 'error'` to `eslint.config.js`.
- [ ] Verify: `npm run lint` (0 errors), `npm test`, `npm run build`, and `grep -rn "console\." src --include='*.ts' --include='*.tsx' | grep -v test | grep -v __mocks__` empty. The six pre-existing `mapEditorPage.tsx` exhaustive-deps warnings stay out of scope (note in commit).

### F2. Route types

**Files:** modify `src/components/map/types.ts` (add `RouteProfile`, `ROUTE_PROFILES`, `InstructionKind`, `RouteLandmark`, `RouteInstruction`, `RouteWarning`, `RouteAlternative`, `RouteClosure`, `EdgeDirection`; extend `RouteSegment`, `RouteStep` (intersection type keeps narrowing), `AssembledRoute`, `MapEdge` (`direction?`, `tags?`), `Poi` (`externalId?`, `aliases?`) — all optional so golden fixtures compile); create `src/components/map/routeGeometry.ts` (`segmentPolyline(segment)` = `points` when ≥ 2 else nodes; three-free; add to the `no-restricted-imports` list in `eslint.config.js`).
- [ ] Test `routeGeometry.test.ts`: prefers points; falls back on absent/degenerate.
- [ ] Verify: `npx tsc -b && npm test -- routeGeometry`

### F3. wayfindingApi contract

**Files:** modify `src/apis/wayfindingApi.ts`: `RouteRequest += toExternalId?, targets?[], profile?, heading?`; export pure `buildRouteParams(req)` (`to` per target as `poi:`/`ext:`/nodeId; `profile` when set else `accessible=true` for back-compat; `heading` normalised `((h%360)+360)%360` integer); `fetchEvacuationRoute(fromNodeId, {accessible?, profile?, heading?, signal?})`; `normalizeRoute(raw)` (arrays guaranteed, `totalDistanceM ??= totalDistanceMeters`, drop instructions without `text`), used by both fetchers and exported for the scan page.
- [ ] Test `src/apis/wayfindingApi.test.ts` (mock `./http`): profile URL without `accessible`; repeated `to` + `ext:` encoding; integer heading, omitted when NaN; legacy call exact `from`+`to`; normalizeRoute fills arrays.
- [ ] Verify: `npm test -- wayfindingApi`

### F4. Duration/distance formatting

**Files:** create `src/lib/format.ts` (`durationMinutes(sec)` <60 → 1 else round ≥ 1; `formatDuration(sec, locale)`, `formatDistance(m, locale)`, `formatDistanceAndEta(m, sec, locale)` filling templates from `en`/`ka` messages directly). i18n en/ka: `wayfinding.eta` "{minutes} min" / "{minutes} წთ"; `wayfinding.distanceAndEta` "{meters} m · {minutes} min" / "{meters} მ · {minutes} წთ"; `wayfinding.remaining` "{distance} left" / "დარჩა {distance}"; `wayfinding.remainingTime` "about {minutes} min left" / "დაახლოებით {minutes} წთ დარჩა".
- [ ] Test `format.test.ts`: 45 s → 1 min; 150 s → 3, 149 s → 2; Georgian unit; middle dot join.
- [ ] Verify: `npm test -- format`

### F5. Profile picker, refetch, warnings, totals

**Files:** create `src/components/wayfinding/routeProfile.ts` (localStorage `alertup-route-profile`, default `walk`, `emergency` not selectable), `RouteProfilePicker.tsx` (native `Select`, options walk/wheelchair (reuse orphan `wayfinding.accessibleRoute`)/elevator_first/min_floor_changes); modify `WayfindingPanel.tsx` (`profile` state, `lastSelectionRef`, `refreshing`; `loadRoute(selection,{profile,heading,silent})`; on error keep the previous route if one exists and show the error (static fail-safe); header uses `formatDistanceAndEta`; warnings `<Alert tone="warning">`; tone danger for EVACUATION or `profile==='emergency'`), `RouteStepper.tsx` (remaining distance/time; `segment.accessible===false` → `Badge` `wayfinding.segmentNotAccessible`), `qrScanRoutePage.tsx` (nearest-exit card uses ETA), `qrScanRoutePage.test.tsx` (`toHaveBeenCalledWith('n1', expect.objectContaining({}))`).
i18n en/ka: `wayfinding.profileLabel` "Route preference"/"მარშრუტის ტიპი"; `profileWalk` "Fastest"/"უსწრაფესი"; `profileElevatorFirst` "Prefer elevators"/"ლიფტის უპირატესობა"; `profileMinFloorChanges` "Fewest floor changes"/"ნაკლები სართულის ცვლილება"; `warningsTitle` "Heads-up"/"გაითვალისწინეთ"; `segmentNotAccessible` "Not step-free"/"საფეხურებით".
- [ ] Test `WayfindingPanel.test.tsx`: profile change refetches same destination and resets progress; persists to localStorage; failed refetch keeps previous route; renders warnings + distance/ETA.
- [ ] Verify: `npm test -- WayfindingPanel qrScanRoutePage && npm run lint`

### F6. Instructions in the stepper + compass heading

**Files:** modify `src/components/wayfinding/useRouteProgress.ts` (exported pure `buildFeed(route)`: one entry per instruction mapped to a step index (arrive → arrive step; transit → transit step matching `floorChange`, fallback by `afterSegmentIndex`; else walk step by `segmentIndex`); identity feed when no instructions; `RouteProgress += activeStepIndex, activeInstruction, feedLength`), `RouteStepper.tsx` (instruction title `text[lang] ?? text.en` in `<p aria-live="polite" aria-atomic="true">`, distance/ETA line, landmark line, `INSTRUCTION_ROTATION: Record<InstructionKind, number>` on an `aria-hidden` arrow; transit/arrive keep existing cards; fallback to client templates), create `src/lib/useDeviceHeading.ts` (`{heading, state:'unsupported'|'idle'|'granted'|'denied', request()}`; `requestPermission` only inside the tap; `deviceorientationabsolute` fallback `deviceorientation`; `webkitCompassHeading ?? (360−alpha)%360`; ≤ 1 Hz), `WayfindingPanel.tsx` (single heading refetch per route, guarded by ref; passes `activeStepIndex` to `Map3DRoute`).
i18n en/ka: `wayfinding.landmark` "{name} on your {side}"/"{name} თქვენს {side}"; `sideLeft` "left"/"მარცხნივ"; `sideRight` "right"/"მარჯვნივ"; `useCompass` "Use compass"/"კომპასის გამოყენება"; `compassDenied` "Compass access was declined."/"კომპასზე წვდომა უარყოფილია."; `facing` "Facing {deg}°"/"მიმართულება {deg}°".
- [ ] Tests: `useRouteProgress.test.ts` (buildFeed mapping; floor advances only past transit instruction; syncToFloorNumber lands on first instruction of floor; `activeStepIndex` valid); new `RouteStepper.test.tsx` (server text in active language with landmark; fallback templates; aria-live; compass button only on first instruction); `useDeviceHeading.test.ts` (unsupported in jsdom; webkitCompassHeading else 360−alpha).
- [ ] Verify: `npm test -- wayfinding useDeviceHeading && npm run lint`

### F7. Alternative exits

**Files:** modify `DestinationSearch.tsx` (`DestinationSelection.kind += 'exit'`), `WayfindingPanel.tsx` (`kind==='exit'` → `fetchRoute({fromNodeId, toNodeId: selection.nodeId, profile:'emergency', heading})`), create `AlternativeExits.tsx` (up to 2, excluding `route.destination.nodeId`, `Button variant="secondary"` with label/floor/ETA text). i18n: `wayfinding.alternativeExits` "Other exits"/"სხვა გასასვლელები".
- [ ] Tests (WayfindingPanel.test.tsx): at most two alternatives with distance/ETA in evacuation mode; tapping routes to that exit with `profile=emergency`; none for wayfinding routes.
- [ ] Verify: `npm test -- WayfindingPanel`

### F8. Route rendering: smoothed points + missing CSS animations

**Files:** modify `src/components/map/layers/RouteLayer.tsx` (`segmentPolyline`), `src/components/map3d/routeScene.ts:97–104`, `sceneBuilder.ts:343–346`, `src/index.css` (add `@keyframes route-draw`, `route-march`, classes `.route-path-draw` (`stroke-dasharray:1; animation: route-draw 900ms ease-out both` — `pathLength={1}` already set), `.route-path-march`, `.map-user-pulse` (reuse `pulse-ring`), and a `prefers-reduced-motion: reduce` block that disables them); fix the stale comment in `RouteLayer.tsx:8`.
- [ ] Tests: `MapCanvas.test.tsx` (path uses points: `d === 'M 100 100 L 200 140 L 300 100'`); `routeScene.test.ts` (specs use points when present).
- [ ] Verify: `npm test -- MapCanvas routeScene sceneBuilder && npm run build` (three still a separate lazy chunk in `dist/assets`).

### F9. Realtime hardening

**Files:** modify `src/emergency/types.ts` (`BuildingEvent += closure_changed {closureId, action:'created'|'updated'|'deleted', blocked, edgeIds?, nodeIds?, reason?, endsAt?}`; `RealtimeChannel += lastHeartbeatAt(), lastSeq()`), `src/lib/realtime.ts` (`SSE_EVENT_TYPES += 'closure_changed'`; separate `heartbeat` listener updating `lastSeq`, `lastHeartbeatAt`, re-arming staleness, restoring `open` from `degraded`; every named frame records `lastEventId` and re-arms; `STALE_AFTER_MS = 55_000` → `degraded`, `resync()`, close and re-enter backoff; manual reconnects append `?sinceSeq=<lastEventId>`; `onStatusChange` replays current status).
- [ ] Test new `src/lib/realtime.test.ts` (FakeEventSource + fake timers + mocked fetch): heartbeat keeps open; 55 s silence → degraded + snapshot fetch; frame after degradation → open; closure_changed reaches subscribers; reconnect URL carries `sinceSeq`; onStatusChange replays.
- [ ] Verify: `npm test -- realtime && npm run lint`

### F10. Degraded indicator + closure-driven refetch + closures alert

**Files:** modify `EmergencyProvider.tsx` (+ `emergencyContext.ts`: `closureVersion` counter on `closure_changed`), `qrScanRoutePage.tsx` (`connection==='degraded'` during emergency/bypassed → `<Alert tone="warning">` `emergency.connectionLost`; pass `refetchToken={closureVersion}`), `WayfindingPanel.tsx` (`refetchToken?` prop → silent reload; `route.closures?.length` → `<Alert tone="info" title=closuresTitle>` with `wayfinding.closureUntil` via `Intl.DateTimeFormat`).
i18n en/ka: `emergency.connectionLost` "Connection lost — showing the last known route."/"კავშირი დაიკარგა — ნაჩვენებია ბოლო ცნობილი მარშრუტი."; `wayfinding.closuresTitle` "Route adjusted for closures"/"მარშრუტი შეცვლილია ჩაკეტვების გამო"; `wayfinding.closureUntil` "{reason} — until {time}"/"{reason} — {time}-მდე".
- [ ] Tests (qrScanRoutePage.test.tsx, extend the realtime stub to drive callbacks): notice only while emergency + degraded; closure_changed refetches; failed refetch keeps route.
- [ ] Verify: `npm test -- qrScanRoutePage && npm run lint`

### F11. Map editor API: closures, edge direction/tags, POI externalId/aliases

**Files:** modify `src/apis/mapEditorApi.ts`: `RawEdge += direction?, tags?`; `toEditorEdge` guards (`BOTH` default, `[]`); `EditorEdge` required `direction`, `tags`; `CreateEdgeInput`/`UpdateEdgeInput += direction?, tags?`; `RawPoi += externalId?, names?`; `toEditorPoi` maps `externalId`, `aliases`; `PoiInput += externalId?, aliases?` (body `names:{aliases}`); `Closure` type `{id, buildingId, floorId, edgeIds, nodeIds, costMultiplier, reason, startsAt, endsAt, createdAt}`; `listClosures(buildingId)` GET, `createClosure(buildingId, {edgeIds, reason, endsAt, costMultiplier?})` POST `/api/map-editor/buildings/:id/closures`, `deleteClosure(buildingId, closureId)` DELETE `/api/map-editor/buildings/:id/closures/:closureId` (matches backend B7).
- [ ] Test `src/apis/mapEditorApi.test.ts`: edge defaults; POI externalId/aliases; createClosure body; deleteClosure path.
- [ ] Verify: `npm test -- mapEditorApi`

### F12. Map editor UI: edge inspector, POI inspector, closures panel

**Files:** modify `src/pages/buildings/mapEditor/edgeInspector.tsx` (direction `Select` with endpoint labels; tags chip input copied from `nodeInspector.tsx:196–235`), `nodeInspector.tsx` (`externalId` TextField with hint; aliases chips), `mapEditorPage.tsx` (widen edge patch; closures state + draft; `handleEdgeClick` toggles membership while a draft is active; Escape cancels; mount `<ClosuresPanel>` under `<ValidationPanel>`), `src/components/map/layers/EdgeLayer.tsx` (`highlightedEdgeIds?: ReadonlySet<string>` danger stroke); create `closuresPanel.tsx` (list with reason/ends/count/delete via `ConfirmDialog`; draft form: reason, duration `radiogroup` 1h/2h/4h/custom `datetime-local`; save disabled until reason + ≥ 1 edge; `aria-live` selected count; keyboard path: "Add to closure" button in the edge inspector while a draft is active).
i18n en/ka under `mapEditor`: `edgeDirection` "Direction"/"მიმართულება"; `edgeDirectionBoth` "Both ways"/"ორივე მიმართულებით"; `edgeDirectionForward` "{from} → {to}"; `edgeTags` "Tags"/"ტეგები"; `edgeTagsHint` "Press Enter to add, e.g. outdoor, narrow."/"დააჭირეთ Enter-ს დასამატებლად, მაგ. outdoor, narrow."; `poiExternalId` "Printed code"/"დაბეჭდილი კოდი"; `poiExternalIdHint` "Visitors can route to it with ext:CODE."/"ვიზიტორებს შეუძლიათ მარშრუტი ext:CODE-ით."; `poiAliases` "Also known as"/"სხვა სახელები"; `closures` "Closures"/"ჩაკეტვები"; `closuresEmpty` "No active closures."/"აქტიური ჩაკეტვები არ არის."; `closureAdd` "Add closure"/"ჩაკეტვის დამატება"; `closurePickEdges` "Tap connections on the map to close them."/"შეეხეთ კავშირებს რუკაზე მათ დასახურად."; `closureSelectedCount` "{count} connections selected"/"არჩეულია {count} კავშირი"; `closureReason` "Reason"/"მიზეზი"; `closureDuration` "Duration"/"ხანგრძლივობა"; `closureHours` "{hours} h"/"{hours} სთ"; `closureCustom` "Custom"/"სხვა"; `closureEndsIn` "Ends {time}"/"მთავრდება {time}"; `closureDelete` "Remove closure"/"ჩაკეტვის წაშლა"; `closureDeleteConfirm` "This reopens the connections immediately."/"კავშირები დაუყოვნებლივ გაიხსნება."; `closureSaved` "Closure saved"/"ჩაკეტვა შენახულია"; `closureAddEdge` "Add to closure"/"ჩაკეტვაში დამატება".
- [ ] Tests: `closuresPanel.test.tsx` (1h preset endsAt; save disabled until valid; delete confirms); `edgeInspector.test.tsx` (saves direction + tags; re-seeds); `nodeInspector.test.tsx` (submits externalId + aliases).
- [ ] Verify: `npm test -- mapEditor closuresPanel edgeInspector && npm run lint`

### F13. Accessibility + i18n sweep

- [ ] `ka.ts` mirrors every new key (`npx tsc -b` proves it); aria-live on instruction title, closure count, connection-lost alert; arrows `aria-hidden` with text direction; no colour-only cues; reduced-motion honoured; keyboard path for closure edge picking (F12).
- [ ] Tests: `RouteStepper.test.tsx` aria-live updates; `georgianTypography.test.tsx` renders one new key in ka.
- [ ] Verify: `npm run lint && npm test && npm run build`; optionally run the `accessibility-scan` skill on `/scan/route/<qr>` under `npm run preview`.

### F14. Final gate

- [ ] `npm run lint` (0 errors), `npm test`, `npm run build`; three still lazy; no new deps (two removed); `git diff --stat` reviewed.

---

## End-to-end verification (per milestone, on stage)

1. Backend `npm test` green twice; frontend `npm run lint && npm test && npm run build` green.
2. Local: `npm run dev` in both repos against the STAGE database; open `http://localhost:5173/scan/route/<real qr slug>`; confirm distance + ETA, profile picker changes the route, step-free shows a warning on a stairs-only building, instructions read correctly in en and ka, alternative exits appear in evacuation, a closure created in the editor removes the corridor from a fresh route within 15 s and pushes `closure_changed` to the open page (DevTools → EventStream shows `id:` and `heartbeat` frames).
3. Kill the backend while the scan page is open: within 55 s the page shows the connection-lost notice and keeps the route; restart: status returns to open with a `state` snapshot.
4. Push both repos to `stage` with the `push` skill (the uncommitted pre-existing work rides along, as decided); smoke the same flow on stage.alertup.world.
5. After M3: run `merge-stage-to-preprod` (now unblocked by F1).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| react-hooks v7 surfaces more errors as fixes land | lint after every file; `useLatestRef` + derive-in-render applied proactively |
| Shared mutable cached graph | overlays are closures; safety fields in a `WeakMap` keyed by graph object; assembler never writes to graph objects |
| `dijkstra.test.js` px-cost assertions | default `costFn = e => e.cost`; time costs opt-in |
| `BigInt` in JSON | `eventLog` converts `seq` with `Number()` at the boundary |
| Directed edges vs. `validateGraph` symmetry assumption | BFS over `radj`; `EDGE_ONE_WAY_DEAD_END` warning |
| Express 5 async handler rejections | keep explicit try/catch; fire-and-forget writes only via `analyticsQueue.enqueue` |
| SSE persistence failure | emit first, persist async; `state` on connect + heartbeat seq gaps self-heal |
| Frontend golden fixtures | all new fields optional; `qrScanRoutePage.test` expectation relaxed to `objectContaining` |
| `Last-Event-ID` lost on manual reconnect | `?sinceSeq=` query alias on the server |
| iOS DeviceOrientation permission | request only inside a tap; single refetch per route; jsdom → unsupported |
| Georgian instruction wording | strings flagged for the founder's native review before M2 ships |
| Stage database shared with pre-prod | migration is additive; `npm run db:migrate` locally applies to stage; prod gets it only on the production deploy's `prisma migrate deploy` |
