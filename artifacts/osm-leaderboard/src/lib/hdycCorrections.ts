// Loads corrections/hdyc-corrections.json — a small dataset distilled from
// saved https://hdyc.neis-one.org snapshots (see scripts/src/extract-hdyc-corrections.ts).
//
// Why: our own "All Time" aggregation pages back through a user's changesets
// with a safety cap (see osmApi.ts) to stay responsive from the browser, so
// very active mappers are undercounted for that period. HDYC computes over
// the full OSM history dump with no such cap, so where we have a saved
// snapshot for a user, it's used as a floor for the numbers our own capped
// aggregation would otherwise understate.

export interface HdycCorrection {
  asOf: string;
  since: string;
  totalChangesets: number;
  totalChanges: number;
  buildingsCreated: number;
  buildingsModified: number;
}

interface HdycCorrectionsFile {
  generatedAt: string;
  source: string;
  users: Record<string, HdycCorrection>;
}

export async function fetchHdycCorrections(): Promise<Record<string, HdycCorrection>> {
  const url = import.meta.env.BASE_URL + "hdyc-corrections.json";
  const response = await fetch(url);
  if (!response.ok) return {}; // optional dataset — absence is not an error
  const data = (await response.json()) as HdycCorrectionsFile;
  return data.users ?? {};
}
