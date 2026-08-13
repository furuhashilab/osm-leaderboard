// Per-changeset diff aggregation for Buildings / Wheelchair.
//
// Buildings/Wheelchair used to come from a global Overpass `(user:"...")` scan
// with no bounding box — a full-planet scan that Overpass rate-limits or
// times out on almost every call, so it silently returned 0. This module
// instead ties those two metrics to the same aggregation unit as
// Changes/Hashtags (the user's changesets): each changeset's diff
// (`/api/0.6/changeset/{id}/download`) is downloaded and its created/modified
// elements are scanned for `building` / `wheelchair` tags.

import { Changeset } from './osmApi';

interface DiffStats {
  buildings: number;
  wheelchair: number;
}

// Changesets are immutable once closed, so cache diffs aggressively.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 h
const CONCURRENCY = 5;

function cacheKey(changesetId: string): string {
  return `csdiff_v1_${changesetId}`;
}

function readCache(key: string): DiffStats | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL_MS) return data;
    localStorage.removeItem(key);
  } catch {
    // ignore parse / quota errors
  }
  return null;
}

function writeCache(key: string, data: DiffStats): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore quota errors — caching is a pure optimization
  }
}

function countTaggedElements(doc: Document, tagKey: string, elementTypes: string[]): number {
  let count = 0;
  doc.querySelectorAll("create, modify").forEach(section => {
    Array.from(section.children).forEach(el => {
      if (!elementTypes.includes(el.tagName)) return;
      const hasTag = Array.from(el.querySelectorAll("tag")).some(t => t.getAttribute("k") === tagKey);
      if (hasTag) count++;
    });
  });
  return count;
}

async function fetchChangesetDiffStats(changesetId: string): Promise<DiffStats> {
  const key = cacheKey(changesetId);
  const cached = readCache(key);
  if (cached) return cached;

  const res = await fetch(`https://api.openstreetmap.org/api/0.6/changeset/${changesetId}/download`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Failed to download changeset ${changesetId}: ${res.status}`);

  const doc = new DOMParser().parseFromString(await res.text(), "text/xml");
  const stats: DiffStats = {
    // Buildings mirrors the prior Overpass definition: way/relation only, not nodes.
    buildings: countTaggedElements(doc, "building", ["way", "relation"]),
    wheelchair: countTaggedElements(doc, "wheelchair", ["node", "way", "relation"]),
  };

  writeCache(key, stats);
  return stats;
}

/** Sums Buildings/Wheelchair across a set of changesets with bounded concurrency. */
export async function fetchBuildingWheelchairStats(changesets: Changeset[]): Promise<{ buildingsAdded: number; wheelchairMapped: number }> {
  let buildingsAdded = 0;
  let wheelchairMapped = 0;
  let index = 0;

  async function worker() {
    while (index < changesets.length) {
      const changeset = changesets[index++];
      try {
        const { buildings, wheelchair } = await fetchChangesetDiffStats(changeset.id);
        buildingsAdded += buildings;
        wheelchairMapped += wheelchair;
      } catch (error) {
        console.warn(`changeset diff unavailable for #${changeset.id}:`, (error as Error).message);
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, changesets.length) }, worker);
  await Promise.all(workers);

  return { buildingsAdded, wheelchairMapped };
}
