# OSM Leaderboard

    OpenStreetMap contributor leaderboard — real-time edit stats with MapLibre GL 3D map, period filters, and PWA support.

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
    