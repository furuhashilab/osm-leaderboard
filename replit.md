# OSM Leaderboard

A client-side OpenStreetMap contributor leaderboard that fetches real edit stats from OSM public APIs and displays ranked contributors with TOP3 gold/silver/bronze highlights, an interactive 3D map, and PWA support.

## Run & Operate

- `pnpm --filter @workspace/osm-leaderboard run dev` — run the leaderboard frontend (port auto-assigned)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui
- Map: MapLibre GL JS + OpenFreeMap (vector tiles, 3D buildings)
- YAML parsing: js-yaml
- Animations: framer-motion
- API: Express 5 (shared api-server)
- DB: PostgreSQL + Drizzle ORM (not yet used by leaderboard)
- Validation: Zod, drizzle-zod
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `artifacts/osm-leaderboard/` — React frontend
  - `src/components/Leaderboard.tsx` — ranked list with TOP3 highlights
  - `src/components/UserCard.tsx` — individual user card
  - `src/components/MapPanel.tsx` — MapLibre GL map with WebGL2 fallback
  - `src/components/PeriodTabs.tsx` — Daily/Weekly/Monthly/Yearly/All Time filter
  - `src/hooks/useOSMData.ts` — TanStack Query data orchestration
  - `src/lib/osmApi.ts` — OSM Changeset API (XML parsing)
  - `src/lib/overpassApi.ts` — Overpass API with sessionStorage cache + queue
  - `src/lib/parseUsers.ts` — YAML user config parser
  - `public/users.yaml` — user roster and hashtag config
  - `public/manifest.json` + `public/sw.js` — PWA files
- `artifacts/api-server/` — shared Express API server
- `lib/api-spec/openapi.yaml` — API contract source of truth

## Architecture decisions

- **Client-side only**: All OSM data is fetched live from the browser. No backend proxy for OSM/Overpass APIs (yet — see Task #1 for the upgrade path).
- **Overpass graceful degradation**: Building and wheelchair counts fall back to 0 if Overpass is blocked or rate-limited; the leaderboard still shows changeset-based scores.
- **MapLibre + WebGL2**: The map requires WebGL2; a clean fallback message is shown when unavailable (e.g. preview iframes, older browsers).
- **Score formula**: `totalChanges + buildingsAdded×5 + wheelchairMapped×3 + hashtagChangesets×2`
- **Overpass queue**: Requests are throttled with a 500ms delay and 8s timeout. A module-level `overpassBlocked` flag skips queue delays on repeated network failures.
- **sessionStorage cache**: Overpass responses cached for 5 minutes to avoid repeated API calls on period tab switches.

## Product

- Loads `public/users.yaml` to get the contributor roster and hashtag list
- Fetches changesets from `api.openstreetmap.org/api/0.6/changesets` (XML)
- Fetches building/wheelchair counts from `overpass-api.de` (JSON)
- Shows a ranked leaderboard with 5 period filters and animated TOP3 cards
- Clicking a user's "View on Map" button flies the MapLibre camera to their last edit location

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Overpass API is blocked in the Replit preview sandbox (network restriction). It works fine in deployed/local environments.
- MapLibre GL JS requires WebGL2 — always pre-check with `canvas.getContext('webgl2')` before instantiating `new maplibregl.Map(...)` to avoid an uncaught async error.
- `js-yaml` v5 is ESM-only — use `import { load } from 'js-yaml'`, not `import yaml from 'js-yaml'`.
- `maplibre-gl` must be excluded from Vite's `optimizeDeps` to avoid the worker mjs resolution error. See `vite.config.ts`.
- Do not add maplibre-gl to `optimizeDeps.include`; the `exclude` entry is the correct fix.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
