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
    
