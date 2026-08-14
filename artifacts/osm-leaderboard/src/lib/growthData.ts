// Monthly cumulative TOTAL SCORE per user, for the growth chart.
//
// Reuses the same building blocks as the main leaderboard (osmApi.ts,
// changesetDiff.ts, changesetMatchesHashtags) so a changeset's contribution
// to the score is computed identically here and there — this is not a
// separate approximation, just the same per-changeset score bucketed by
// month instead of summed into one period total.

import { fetchUserChangesets } from './osmApi';
import { fetchChangesetDiffStatsByChangeset } from './changesetDiff';
import { changesetMatchesHashtags, SCORE_WEIGHTS } from '@/hooks/useOSMData';
import { subMonths, startOfMonth, format } from 'date-fns';

export const GROWTH_MONTHS = 36;

export interface MonthlyGrowthPoint {
  month: string; // 'yyyy-MM'
  score: number; // cumulative TOTAL SCORE as of the end of this month
}

function monthKeysForWindow(): string[] {
  const anchor = startOfMonth(new Date());
  return Array.from({ length: GROWTH_MONTHS }, (_, i) => format(subMonths(anchor, GROWTH_MONTHS - 1 - i), 'yyyy-MM'));
}

/**
 * Cumulative TOTAL SCORE by month for the last GROWTH_MONTHS months.
 * Subject to the same changeset pagination cap as everywhere else
 * (fetchUserChangesets) — very active mappers may be undercounted in the
 * earliest months of the window for the same reason "All Time" is.
 */
export async function fetchUserMonthlyGrowth(username: string, configuredHashtags: string[]): Promise<MonthlyGrowthPoint[]> {
  const months = monthKeysForWindow();
  const since = subMonths(startOfMonth(new Date()), GROWTH_MONTHS - 1);

  const changesets = (await fetchUserChangesets(username, since)).filter(c => new Date(c.created_at) >= since);
  const diffByChangeset = await fetchChangesetDiffStatsByChangeset(changesets);

  const monthlyScore = new Map<string, number>(months.map(m => [m, 0]));

  for (const c of changesets) {
    const month = format(new Date(c.created_at), 'yyyy-MM');
    if (!monthlyScore.has(month)) continue; // defensive: outside the window
    const diff = diffByChangeset.get(c.id);
    const hashtagBonus = changesetMatchesHashtags(c, configuredHashtags) ? SCORE_WEIGHTS.hashtag : 0;
    const changesetScore =
      c.changes_count +
      (diff?.buildings ?? 0) * SCORE_WEIGHTS.buildings +
      (diff?.wheelchair ?? 0) * SCORE_WEIGHTS.wheelchair +
      hashtagBonus;
    monthlyScore.set(month, monthlyScore.get(month)! + changesetScore);
  }

  let cumulative = 0;
  return months.map(month => {
    cumulative += monthlyScore.get(month)!;
    return { month, score: cumulative };
  });
}
