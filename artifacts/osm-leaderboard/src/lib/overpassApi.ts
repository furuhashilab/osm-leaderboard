// Overpass API utility — serial queue with localStorage cache and 429 backoff
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// --- Cache helpers ---------------------------------------------------------
// TTL: 15 min for time-bounded periods, 1 h for "all time" (no newerThan filter)
const CACHE_TTL_BOUNDED_MS = 15 * 60 * 1000;  // 15 min
const CACHE_TTL_ALL_TIME_MS = 60 * 60 * 1000; // 1 h

function cacheKey(body: string): string {
  // Use a stable hash of the body so the key doesn't get too long
  let h = 5381;
  for (let i = 0; i < body.length; i++) {
    h = (Math.imul(h, 31) + body.charCodeAt(i)) >>> 0;
  }
  return `overpass_v2_${h.toString(36)}`;
}

function ttlForBody(body: string): number {
  // "All time" queries contain no `newer:` filter
  return body.includes('newer:') ? CACHE_TTL_BOUNDED_MS : CACHE_TTL_ALL_TIME_MS;
}

function readCache(key: string, ttl: number): unknown | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts < ttl) return data;
    localStorage.removeItem(key);
  } catch {
    // ignore parse / quota errors
  }
  return null;
}

function writeCache(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // localStorage full — evict oldest overpass entries then retry once
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('overpass_')) keysToRemove.push(k);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      // ignore if still full
    }
  }
}

// --- Serial async queue ----------------------------------------------------
// Ensures at most 1 Overpass request is in-flight at a time, with a gap
// between requests to stay within rate limits.
const MIN_GAP_MS = 1100; // ≥1 s between consecutive requests (Overpass guideline)

let _tail: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  // Chain onto the tail so requests execute strictly one-at-a-time
  const result = _tail.then(() => fn());
  // The tail must never reject (otherwise all future enqueued tasks fail)
  _tail = result
    .catch(() => {/* error surfaced in result, not in tail */})
    .then(() => new Promise<void>(resolve => setTimeout(resolve, MIN_GAP_MS)));
  return result;
}

// --- Fetch with 429 retry --------------------------------------------------
async function fetchWithRetry(body: string, attempt = 0): Promise<unknown> {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(20_000), // generous timeout for busy server
  });

  if (res.status === 429 || res.status === 503) {
    // Overpass is overloaded — back off and retry (up to 3 attempts)
    if (attempt < 3) {
      const backoff = Math.min(5000 * 2 ** attempt, 30_000); // 5 s, 10 s, 20 s
      console.warn(`Overpass ${res.status} — retrying in ${backoff / 1000}s (attempt ${attempt + 1})`);
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(body, attempt + 1);
    }
    throw new Error(`Overpass API error: ${res.status} ${res.statusText}`);
  }

  if (!res.ok) {
    throw new Error(`Overpass API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// --- Public fetch entry point ----------------------------------------------
async function queuedFetch(body: string): Promise<unknown> {
  const key = cacheKey(body);
  const ttl = ttlForBody(body);

  const cached = readCache(key, ttl);
  if (cached !== null) return cached;

  // Queue the network request so only one fires at a time
  const data = await enqueue(() => fetchWithRetry(body));
  writeCache(key, data);
  return data;
}

// --- Query helpers ---------------------------------------------------------
function getNewerFilter(periodStr?: string) {
  if (!periodStr) return '';
  return `(newer:"${periodStr}")`;
}

// --- Exported functions ----------------------------------------------------
export async function fetchUserBuildingsCount(username: string, newerThanIso?: string): Promise<number> {
  const newer = getNewerFilter(newerThanIso);
  const query = `[out:json];(way${newer}(user:"${username}")[building];relation${newer}(user:"${username}")[building];);out count;`;

  try {
    const data = await queuedFetch(query) as any;
    const tags = data?.elements?.[0]?.tags;
    if (!tags) return 0;
    return (tags.ways || 0) + (tags.relations || 0) || tags.total || 0;
  } catch (error) {
    console.warn(`Overpass buildings unavailable for ${username}:`, (error as Error).message);
    return 0;
  }
}

export async function fetchUserWheelchairCount(username: string, newerThanIso?: string): Promise<number> {
  const newer = getNewerFilter(newerThanIso);
  const query = `[out:json];(node${newer}(user:"${username}")[wheelchair];way${newer}(user:"${username}")[wheelchair];relation${newer}(user:"${username}")[wheelchair];);out count;`;

  try {
    const data = await queuedFetch(query) as any;
    const tags = data?.elements?.[0]?.tags;
    if (!tags) return 0;
    const total = (tags.nodes || 0) + (tags.ways || 0) + (tags.relations || 0);
    return total || tags.total || 0;
  } catch (error) {
    console.warn(`Overpass wheelchair unavailable for ${username}:`, (error as Error).message);
    return 0;
  }
}
