import { useQuery } from '@tanstack/react-query';
import { fetchUsersConfig } from '@/lib/parseUsers';
import { Changeset, fetchUserChangesets } from '@/lib/osmApi';
import { fetchBuildingWheelchairStats } from '@/lib/changesetDiff';
import { fetchHdycCorrections, HdycCorrection } from '@/lib/hdycCorrections';
import { getMapperLevelInfo, MapperLevelInfo } from '@/lib/mapperLevel';
import { Period, UserStats } from '@/types';
import { subDays, subYears, isAfter } from 'date-fns';

// score = totalChanges + buildingsAdded×WEIGHT.buildings + wheelchairMapped×WEIGHT.wheelchair + hashtagChangesets×WEIGHT.hashtag
// Shared with lib/growthData.ts, which computes the same score per-changeset for the growth chart.
export const SCORE_WEIGHTS = { buildings: 5, wheelchair: 3, hashtag: 2 } as const;

// A changeset counts as matching a configured hashtag if it's present in the
// changeset's own `hashtags` tag, or appears anywhere in the comment. Substring
// matching (rather than whitespace-tokenizing the comment) is deliberate: many
// Japanese-language comments have no space around hashtags (e.g. "#PLATEAUで測量"),
// so word-splitting on `\s+` misses them entirely.
export function changesetMatchesHashtags(changeset: Changeset, configuredHashtags: string[]): boolean {
  if (configuredHashtags.length === 0) return false;
  const commentLower = changeset.comment.toLowerCase();
  return configuredHashtags.some(h => changeset.hashtagsTag.includes(h) || commentLower.includes(h));
}

function getStartDateForPeriod(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case 'Daily': return subDays(now, 1);
    case 'Weekly': return subDays(now, 7);
    case 'Monthly': return subDays(now, 30);
    case 'Yearly': return subYears(now, 1);
    case 'All Time': return null;
  }
}

export function useUsersConfig() {
  return useQuery({
    queryKey: ['usersConfig'],
    queryFn: fetchUsersConfig,
    staleTime: Infinity, // Seldom changes
  });
}

export function useHdycCorrections() {
  return useQuery({
    queryKey: ['hdycCorrections'],
    queryFn: fetchHdycCorrections,
    staleTime: Infinity, // Static file, redeployed manually when corrections are re-extracted
  });
}

export async function fetchUserStatsData(username: string, period: Period, configuredHashtags: string[], hdycCorrection?: HdycCorrection): Promise<UserStats> {
  const startDate = getStartDateForPeriod(period);

  // 1. Fetch changesets (paginated back to startDate, or up to the safety cap for "All Time")
  let allChangesets = await fetchUserChangesets(username, startDate);

  // Filter by period (pagination stops early but doesn't trim the last page precisely)
  if (startDate) {
    allChangesets = allChangesets.filter(c => isAfter(new Date(c.created_at), startDate));
  }

  let totalChangesets = allChangesets.length;
  let totalChanges = allChangesets.reduce((sum, c) => sum + c.changes_count, 0);

  // Count hashtag changesets
  let hashtagChangesets = 0;
  for (const c of allChangesets) {
    if (changesetMatchesHashtags(c, configuredHashtags)) {
      hashtagChangesets++;
    }
  }
  
  // Last changeset for map
  let lastChangeset = undefined;
  if (allChangesets.length > 0) {
    const sorted = [...allChangesets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const mostRecent = sorted.find(c => c.min_lat !== undefined && c.min_lon !== undefined); // Only ones with bbox
    if (mostRecent) {
      lastChangeset = {
        id: mostRecent.id,
        createdAt: new Date(mostRecent.created_at),
        bbox: {
          minLat: mostRecent.min_lat!,
          minLon: mostRecent.min_lon!,
          maxLat: mostRecent.max_lat!,
          maxLon: mostRecent.max_lon!
        },
        comment: mostRecent.comment
      };
    }
  }
  
  // 2. Buildings/Wheelchair: aggregated from the same changesets above (diff-based),
  // not a separate Overpass query — see lib/changesetDiff.ts for why.
  let { buildingsAdded, wheelchairMapped } = await fetchBuildingWheelchairStats(allChangesets);

  // 3. Correction: for "All Time", our own changeset pagination is capped (see
  // osmApi.ts) so very active mappers are undercounted. Where a saved HDYC
  // snapshot exists for this user, use it as a floor — HDYC computes over the
  // full OSM history with no such cap. Never applied to bounded periods
  // (Daily/Weekly/Monthly/Yearly), where our own live data is already complete.
  if (period === 'All Time' && hdycCorrection) {
    totalChangesets = Math.max(totalChangesets, hdycCorrection.totalChangesets);
    totalChanges = Math.max(totalChanges, hdycCorrection.totalChanges);
    buildingsAdded = Math.max(buildingsAdded, hdycCorrection.buildingsCreated + hdycCorrection.buildingsModified);
  }

  const score = totalChanges + (buildingsAdded * SCORE_WEIGHTS.buildings) + (wheelchairMapped * SCORE_WEIGHTS.wheelchair) + (hashtagChangesets * SCORE_WEIGHTS.hashtag);
  
  return {
    username,
    totalChangesets,
    totalChanges,
    buildingsAdded,
    wheelchairMapped,
    hashtagChangesets,
    score,
    lastChangeset,
    profileUrl: `https://www.openstreetmap.org/user/${encodeURIComponent(username)}`,
    rank: 0 // Will be set by parent
  };
}

export function useUserStats(username: string, period: Period, configuredHashtags: string[], hdycCorrection?: HdycCorrection) {
  return useQuery({
    queryKey: ['userStats', username, period],
    queryFn: () => fetchUserStatsData(username, period, configuredHashtags, hdycCorrection),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    enabled: !!username && !!period,
  });
}

// HOT Tasking Manager mapper level (Beginner/Intermediate/Advanced) is based on
// *lifetime* changeset count, independent of the leaderboard's period filter.
// Deliberately lighter than fetchUserStatsData: it only paginates the changeset
// list (same cap/HDYC-floor logic as "All Time") and skips the per-changeset
// diff download that Buildings/Wheelchair need, since level only cares about count.
export async function fetchMapperLevelData(username: string, hdycCorrection?: HdycCorrection): Promise<MapperLevelInfo> {
  const changesets = await fetchUserChangesets(username, null);
  let totalChangesets = changesets.length;
  if (hdycCorrection) {
    totalChangesets = Math.max(totalChangesets, hdycCorrection.totalChangesets);
  }
  return getMapperLevelInfo(totalChangesets);
}

export function useMapperLevel(username: string, hdycCorrection?: HdycCorrection) {
  return useQuery({
    queryKey: ['mapperLevel', username],
    queryFn: () => fetchMapperLevelData(username, hdycCorrection),
    staleTime: 30 * 60 * 1000, // lifetime changeset count moves slowly; refetch less eagerly than period stats
    retry: 1,
    enabled: !!username,
  });
}
