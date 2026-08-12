import { useQuery } from '@tanstack/react-query';
import { fetchUsersConfig } from '@/lib/parseUsers';
import { fetchUserChangesets } from '@/lib/osmApi';
import { fetchUserBuildingsCount, fetchUserWheelchairCount } from '@/lib/overpassApi';
import { Period, UserStats } from '@/types';
import { subDays, subYears, isAfter } from 'date-fns';

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
  const startDateIso = startDate ? startDate.toISOString() : undefined;
  
  // 1. Fetch changesets
  let allChangesets = await fetchUserChangesets(username);
  
  // Filter by period
  if (startDate) {
    allChangesets = allChangesets.filter(c => isAfter(new Date(c.created_at), startDate));
  }
  
  const totalChangesets = allChangesets.length;
  const totalChanges = allChangesets.reduce((sum, c) => sum + c.changes_count, 0);
  
  // Count hashtag changesets
  let hashtagChangesets = 0;
  for (const c of allChangesets) {
    if (c.hashtags.some(h => configuredHashtags.includes(h))) {
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
  
  // 2. Fetch from Overpass
  const [buildingsAdded, wheelchairMapped] = await Promise.all([
    fetchUserBuildingsCount(username, startDateIso),
    fetchUserWheelchairCount(username, startDateIso)
  ]);
  
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
