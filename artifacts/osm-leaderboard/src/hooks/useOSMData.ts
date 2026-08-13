import { useQuery } from '@tanstack/react-query';
import { fetchUsersConfig } from '@/lib/parseUsers';
import { Changeset, fetchUserChangesets } from '@/lib/osmApi';
import { fetchBuildingWheelchairStats } from '@/lib/changesetDiff';
import { Period, UserStats } from '@/types';
import { subDays, subYears, isAfter } from 'date-fns';

// A changeset counts as matching a configured hashtag if it's present in the
// changeset's own `hashtags` tag, or appears anywhere in the comment. Substring
// matching (rather than whitespace-tokenizing the comment) is deliberate: many
// Japanese-language comments have no space around hashtags (e.g. "#PLATEAUで測量"),
// so word-splitting on `\s+` misses them entirely.
function changesetMatchesHashtags(changeset: Changeset, configuredHashtags: string[]): boolean {
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

export async function fetchUserStatsData(username: string, period: Period, configuredHashtags: string[]): Promise<UserStats> {
  const startDate = getStartDateForPeriod(period);

  // 1. Fetch changesets (paginated back to startDate, or up to the safety cap for "All Time")
  let allChangesets = await fetchUserChangesets(username, startDate);

  // Filter by period (pagination stops early but doesn't trim the last page precisely)
  if (startDate) {
    allChangesets = allChangesets.filter(c => isAfter(new Date(c.created_at), startDate));
  }

  const totalChangesets = allChangesets.length;
  const totalChanges = allChangesets.reduce((sum, c) => sum + c.changes_count, 0);

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
  const { buildingsAdded, wheelchairMapped } = await fetchBuildingWheelchairStats(allChangesets);

  const score = totalChanges + (buildingsAdded * 5) + (wheelchairMapped * 3) + (hashtagChangesets * 2);
  
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

export function useUserStats(username: string, period: Period, configuredHashtags: string[]) {
  return useQuery({
    queryKey: ['userStats', username, period],
    queryFn: () => fetchUserStatsData(username, period, configuredHashtags),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    enabled: !!username && !!period,
  });
}
