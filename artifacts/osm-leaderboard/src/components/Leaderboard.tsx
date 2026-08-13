import { useQueries } from "@tanstack/react-query";
import { UserStats, Period } from "@/types";
import { useUsersConfig, fetchUserStatsData } from "@/hooks/useOSMData";
import { UserCard } from "./UserCard";
import { useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LeaderboardProps {
  period: Period;
  onViewMap: (stats: UserStats) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export function Leaderboard({ period, onViewMap, onLoadingChange }: LeaderboardProps) {
  const { data: config, isLoading: isConfigLoading } = useUsersConfig();
  
  const users = config?.users || [];
  const hashtags = config?.hashtags || [];

  const userQueries = useQueries({
    queries: users.map(username => ({
      queryKey: ['userStats', username, period],
      queryFn: () => fetchUserStatsData(username, period, hashtags),
      staleTime: 5 * 60 * 1000,
      retry: 1,
    }))
  });

  const isLoading = isConfigLoading || userQueries.some(q => q.isLoading && !q.data);
  const isFetching = isConfigLoading || userQueries.some(q => q.isFetching);

  // Notify parent of loading state changes
  useEffect(() => {
    onLoadingChange?.(isFetching);
  }, [isFetching, onLoadingChange]);

  const rankedUsers = useMemo(() => {
    const loadedStats = userQueries
      .filter(q => q.isSuccess && q.data)
      .map(q => q.data as UserStats);
      
    // Sort by score desc
    loadedStats.sort((a, b) => b.score - a.score);
    
    // Assign ranks
    let currentRank = 1;
    for (let i = 0; i < loadedStats.length; i++) {
      if (i > 0 && loadedStats[i].score < loadedStats[i-1].score) {
        currentRank = i + 1;
      }
      loadedStats[i].rank = currentRank;
    }
    
    return loadedStats;
  }, [userQueries]);

  if (isLoading && rankedUsers.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map(i => <UserCard key={i} stats={{} as any} isLoading />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence mode="popLayout">
        {rankedUsers.map((stats, i) => (
          <motion.div
            key={stats.username}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
          >
            <UserCard 
              stats={stats} 
              onViewMap={onViewMap}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      
      {/* Failed queries */}
      {userQueries.filter(q => q.isError).map((q, i) => {
        const username = users[userQueries.findIndex(uq => uq === q)];
        return (
          <UserCard 
            key={`error-${username}`}
            stats={{ username } as any} 
            isError
            onRetry={() => q.refetch()}
          />
        );
      })}
    </div>
  );
}
