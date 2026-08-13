# OSM Leaderboard
OpenStreetMap contributor leaderboard — real-time edit stats with MapLibre GL 3D map, period filters, and PWA support.

<img width="1800" height="1127" alt="Image" src="https://github.com/user-attachments/assets/98284fc0-278d-4bb7-b9d4-635d3aaacf1a" />

## DEMO
https://mapconcierge.github.io/osm-leaderboard/

    
## Stack
- React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- MapLibre GL JS + OpenFreeMap vector tiles
- TanStack Query for data fetching
- PWA (Service Worker + Web App Manifest)

## Getting Started

```bash
pnpm install
pnpm --filter @workspace/osm-leaderboard run dev
```

Edit `artifacts/osm-leaderboard/public/users.yaml` to configure the contributor roster and hashtags.

## Development

This project is maintained locally with [Claude Code](https://claude.com/claude-code), not Replit. Clone the repo and work from a local checkout; run `pnpm run typecheck` before committing.

## Data Sources & License

- Contributor edit stats (changesets, changeset diffs) come from the [OpenStreetMap API](https://wiki.openstreetmap.org/wiki/API_v0.6) — © OpenStreetMap contributors, [ODbL](https://opendatacommons.org/licenses/odbl/1-0/)
- Code and content in this repository: [CC0 1.0 Universal](LICENSE)

## Author

mapconcierge (Taichi FURUHASHI) — Furuhashi Lab, Aoyama Gakuin University

## Links

- Demo: https://mapconcierge.github.io/osm-leaderboard/
- Repository: https://github.com/mapconcierge/osm-leaderboard
