import { UserStats } from "@/types";
import { cn } from "@/lib/utils";
import { MapPin, Building2, Accessibility, Hash, Edit3 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { useHdycCorrections, useMapperLevel } from "@/hooks/useOSMData";
import { MapperLevelBadge } from "./MapperLevelBadge";

interface UserCardProps {
  stats: UserStats;
  isLoading?: boolean;
  isError?: boolean;
  onViewMap?: (stats: UserStats) => void;
  onRetry?: () => void;
  isTourActive?: boolean;
}

export function UserCard({ stats, isLoading, isError, onViewMap, onRetry, isTourActive }: UserCardProps) {
  if (isLoading) {
    return (
      <div className="bg-card/50 border border-card-border p-6 rounded-2xl animate-pulse flex flex-col gap-4">
        <div className="flex justify-between">
          <div className="h-6 w-32 bg-muted rounded"></div>
          <div className="h-8 w-16 bg-muted rounded"></div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 p-6 rounded-2xl flex items-center justify-between">
        <div className="text-destructive-foreground">Failed to load stats for {stats?.username || 'user'}</div>
        <button 
          onClick={onRetry}
          className="px-4 py-2 bg-destructive/20 hover:bg-destructive/30 text-destructive-foreground rounded-lg transition-colors text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  const { rank, username, score, profileUrl, lastChangeset } = stats;

  const { data: hdycCorrections } = useHdycCorrections();
  const { data: mapperLevel } = useMapperLevel(username, hdycCorrections?.[username]);

  const isTop1 = rank === 1;
  const isTop2 = rank === 2;
  const isTop3 = rank === 3;
  const isTop3Any = isTop1 || isTop2 || isTop3;

  const getRankBadge = () => {
    if (isTop1) return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-bold tracking-wider">CHAMPION</span>;
    if (isTop2) return <span className="bg-slate-300/20 text-slate-300 border border-slate-300/30 px-2 py-0.5 rounded text-xs font-bold tracking-wider">RUNNER UP</span>;
    if (isTop3) return <span className="bg-orange-700/20 text-orange-400 border border-orange-700/30 px-2 py-0.5 rounded text-xs font-bold tracking-wider">3RD PLACE</span>;
    return null;
  };

  const getRankIcon = () => {
    if (isTop1) return "🥇";
    if (isTop2) return "🥈";
    if (isTop3) return "🥉";
    return <span className="text-muted-foreground font-mono text-xl font-bold">#{rank}</span>;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "relative bg-card p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-4 overflow-hidden",
        isTop1 && "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)] bg-gradient-to-br from-amber-500/10 via-card to-card",
        isTop2 && "border-slate-300/50 shadow-[0_0_15px_rgba(203,213,225,0.1)] bg-gradient-to-br from-slate-300/10 via-card to-card",
        isTop3 && "border-orange-700/50 shadow-[0_0_15px_rgba(194,65,12,0.1)] bg-gradient-to-br from-orange-700/10 via-card to-card",
        !isTop3Any && "border-card-border hover:border-primary/50"
      )}
    >
      {/* Glow effect for top 1 */}
      {isTop1 && (
        <motion.div 
          className="absolute inset-0 bg-amber-500/20 blur-xl pointer-events-none"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <div className="relative z-10 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 text-2xl">
            {getRankIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <a 
                href={profileUrl} 
                target="_blank" 
                rel="noreferrer"
                className="font-bold text-lg text-foreground hover:text-primary transition-colors"
              >
                {username}
              </a>
              {getRankBadge()}
            </div>
            {lastChangeset && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Active {formatDistanceToNow(lastChangeset.createdAt, { addSuffix: true })}
              </div>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-muted-foreground font-medium tracking-wide uppercase mb-1">Total Score</div>
          <div className={cn(
            "text-3xl font-black font-mono leading-none tracking-tight",
            isTop1 ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" :
            isTop2 ? "text-slate-300 drop-shadow-[0_0_8px_rgba(203,213,225,0.5)]" :
            isTop3 ? "text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" :
            "text-primary"
          )}>
            {score.toLocaleString()}
          </div>
        </div>
      </div>

      {mapperLevel && (
        <div className="relative z-10">
          <MapperLevelBadge username={username} info={mapperLevel} />
        </div>
      )}

      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatBox icon={<Edit3 size={14}/>} label="Changes" value={stats.totalChanges} color="text-blue-400" />
        <StatBox icon={<Building2 size={14}/>} label="Buildings" value={stats.buildingsAdded} color="text-emerald-400" />
        <StatBox icon={<Accessibility size={14}/>} label="Wheelchair" value={stats.wheelchairMapped} color="text-purple-400" />
        <StatBox icon={<Hash size={14}/>} label="Hashtags" value={stats.hashtagChangesets} color="text-pink-400" />
      </div>

      {lastChangeset && lastChangeset.bbox && (
        <button
          onClick={() => onViewMap?.(stats)}
          className={cn(
            "relative z-10 mt-2 flex items-center justify-center gap-2 w-full py-2 rounded-lg transition-colors text-sm font-medium border",
            isTourActive
              ? "animate-pulse bg-primary text-primary-foreground border-primary shadow-[0_0_12px_rgba(14,165,233,0.5)]"
              : "bg-secondary hover:bg-secondary/80 text-secondary-foreground border-border"
          )}
        >
          <MapPin size={16} className={isTourActive ? "text-primary-foreground" : "text-primary"} />
          View Last Edit on Map
        </button>
      )}
    </motion.div>
  );
}

function StatBox({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  return (
    <div className="flex flex-col bg-background/50 rounded-lg p-2 border border-border/50">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <span className={color}>{icon}</span>
        {label}
      </div>
      <div className="font-mono font-semibold text-foreground text-sm">
        {value.toLocaleString()}
      </div>
    </div>
  );
}
