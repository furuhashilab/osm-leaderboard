import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { UserStats } from '@/types';
import { MapPin } from 'lucide-react';

interface MapPanelProps {
  focusedUser?: UserStats;
}

export function MapPanel({ focusedUser }: MapPanelProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markerInstance = useRef<maplibregl.Marker | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Pre-check WebGL2 availability before constructing the Map
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2');
    if (!gl) {
      setMapError('WebGL2 is required to display the map');
      return;
    }

    if (!mapInstance.current) {
      try {
        mapInstance.current = new maplibregl.Map({
          container: mapRef.current,
          style: 'https://tiles.openfreemap.org/styles/bright',
          center: [0, 30],
          zoom: 2,
          pitch: 45,
          bearing: 0,
          attributionControl: false,
        });

        mapInstance.current.addControl(new maplibregl.NavigationControl(), 'top-right');

        mapInstance.current.on('load', () => {
          const map = mapInstance.current!;
          console.info('[MapPanel] map load fired, canvas size:', map.getCanvas().width, 'x', map.getCanvas().height);

          // Force resize after load to account for any layout shifts during init
          map.resize();

          try {
            map.addLayer({
              id: '3d-buildings',
              source: 'openmaptiles',
              'source-layer': 'building',
              type: 'fill-extrusion',
              minzoom: 14,
              paint: {
                'fill-extrusion-color': '#1a2744',
                'fill-extrusion-height': ['get', 'render_height'],
                'fill-extrusion-base': ['get', 'render_min_height'],
                'fill-extrusion-opacity': 0.8,
              },
            });
          } catch {
            // 3D buildings layer is optional; silently ignore if source not available
          }
        });

        mapInstance.current.on('error', (e) => {
          console.warn('MapLibre error:', e.error?.message);
        });

        mapInstance.current.getCanvas().addEventListener('webglcontextlost', () => {
          console.warn('[MapPanel] WebGL context lost');
        });

        // Watch for container size changes (panel show/hide, window resize)
        const ro = new ResizeObserver(() => {
          mapInstance.current?.resize();
        });
        ro.observe(mapRef.current!);

        // Store observer on the map for cleanup
        (mapInstance.current as any)._resizeObserver = ro;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Map failed to initialize';
        setMapError(message);
      }
    }

    return () => {
      if (mapInstance.current) {
        (mapInstance.current as any)._resizeObserver?.disconnect();
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !focusedUser || !focusedUser.lastChangeset?.bbox) return;

    const bbox = focusedUser.lastChangeset.bbox;
    const centerLng = (bbox.minLon + bbox.maxLon) / 2;
    const centerLat = (bbox.minLat + bbox.maxLat) / 2;

    const doFly = () => {
      if (!mapInstance.current) return;
      mapInstance.current.resize();
      mapInstance.current.flyTo({
        center: [centerLng, centerLat],
        zoom: 15,
        pitch: 60,
        duration: 3000,
        essential: true,
      });

      if (!markerInstance.current) {
        const el = document.createElement('div');
        el.style.cssText = `
          width: 16px; height: 16px;
          background: #0ea5e9;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 15px rgba(14,165,233,0.8);
          animation: pulse 2s infinite;
        `;
        markerInstance.current = new maplibregl.Marker({ element: el })
          .setLngLat([centerLng, centerLat])
          .addTo(mapInstance.current);
      } else {
        markerInstance.current.setLngLat([centerLng, centerLat]);
      }
    };

    // If style is already loaded, fly immediately; otherwise wait for load event
    if (mapInstance.current.isStyleLoaded()) {
      doFly();
    } else {
      mapInstance.current.once('load', doFly);
    }
  }, [focusedUser]);

  if (mapError) {
    return (
      <div className="w-full h-full relative bg-[#0d1117] rounded-l-none md:rounded-l-2xl overflow-hidden border-l border-border flex flex-col items-center justify-center gap-4 text-center p-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30">
          <MapPin className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">Interactive Map</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            WebGL2 is required to render the map. Open this app in a modern browser (Chrome, Firefox, Edge) to see the live 3D map.
          </p>
        </div>
        {focusedUser?.lastChangeset?.bbox && (
          <a
            href={`https://www.openstreetmap.org/#map=14/${(focusedUser.lastChangeset.bbox.minLat + focusedUser.lastChangeset.bbox.maxLat) / 2}/${(focusedUser.lastChangeset.bbox.minLon + focusedUser.lastChangeset.bbox.maxLon) / 2}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
            data-testid="link-view-on-osm"
          >
            View {focusedUser.username}'s last edit on OSM.org →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-muted rounded-l-none md:rounded-l-2xl overflow-hidden border-l border-border shadow-2xl">
      <div ref={mapRef} className="absolute inset-0" />
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_40px_rgba(0,0,0,0.5)] z-10 mix-blend-multiply" />

      {focusedUser && (
        <div className="absolute bottom-6 left-6 z-20 bg-background/80 backdrop-blur-md border border-border p-4 rounded-xl shadow-lg max-w-sm">
          <div className="text-xs text-primary font-mono uppercase tracking-wider mb-1">Target Acquired</div>
          <div className="font-bold text-foreground text-lg mb-1">{focusedUser.username}'s Last Edit</div>
          {focusedUser.lastChangeset?.comment && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              "{focusedUser.lastChangeset.comment}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}
