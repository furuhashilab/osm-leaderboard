// Overpass API utility
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Simple queue to prevent hammering Overpass (but fail fast on network errors)
let lastRequestTime = 0;
const DELAY_MS = 500; // Reduced from 1500ms; still respectful

let overpassBlocked = false; // If we get a network error, skip future waits

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function queuedFetch(body: string): Promise<any> {
  // Check session storage cache first (before any delay)
  const cacheKey = `overpass_${btoa(body).slice(0, 100)}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        return data;
      }
    } catch {
      sessionStorage.removeItem(cacheKey);
    }
  }

  // Skip queue delay if Overpass was recently blocked (network unreachable)
  if (!overpassBlocked) {
    const now = Date.now();
    const timeSinceLast = now - lastRequestTime;
    if (timeSinceLast < DELAY_MS) {
      await wait(DELAY_MS - timeSinceLast);
    }
    lastRequestTime = Date.now();
  }

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(8000), // 8s timeout
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Cache successful response
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // sessionStorage full — ignore
  }

  overpassBlocked = false;
  return data;
}

function getNewerFilter(periodStr?: string) {
  if (!periodStr) return '';
  return `(newer:"${periodStr}")`;
}

export async function fetchUserBuildingsCount(username: string, newerThanIso?: string): Promise<number> {
  const newer = getNewerFilter(newerThanIso);
  const query = `[out:json];(way${newer}(user:"${username}")[building];relation${newer}(user:"${username}")[building];);out count;`;

  try {
    const data = await queuedFetch(query);
    const tags = data?.elements?.[0]?.tags;
    if (!tags) return 0;
    return tags.ways || tags.total || 0;
  } catch (error) {
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('network'))) {
      overpassBlocked = true; // Skip future waits
    }
    console.warn(`Overpass buildings unavailable for ${username}:`, (error as Error).message);
    return 0;
  }
}

export async function fetchUserWheelchairCount(username: string, newerThanIso?: string): Promise<number> {
  const newer = getNewerFilter(newerThanIso);
  const query = `[out:json];(node${newer}(user:"${username}")[wheelchair];way${newer}(user:"${username}")[wheelchair];relation${newer}(user:"${username}")[wheelchair];);out count;`;

  try {
    const data = await queuedFetch(query);
    const tags = data?.elements?.[0]?.tags;
    if (!tags) return 0;
    const total = (tags.nodes || 0) + (tags.ways || 0) + (tags.relations || 0);
    return total || tags.total || 0;
  } catch (error) {
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('network'))) {
      overpassBlocked = true;
    }
    console.warn(`Overpass wheelchair unavailable for ${username}:`, (error as Error).message);
    return 0;
  }
}
