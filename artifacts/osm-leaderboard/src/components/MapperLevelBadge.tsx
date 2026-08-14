import { Award, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MapperLevelInfo } from "@/lib/mapperLevel";

// Single-hue ordinal ramp (blue), validated with the dataviz skill's
// six-checks validator against this app's dark card surface (#0e152a):
//   node validate_palette.js "#86b6ef,#3987e5,#1c5cab" --mode dark --surface "#0e152a" --ordinal --pairs all
// -> ALL CHECKS PASS (lightness monotone, adjacent ΔL, light-end contrast, single hue)
const LEVEL_STYLE = {
  Beginner: { accent: "#86b6ef", label: "Beginner" },
  Intermediate: { accent: "#3987e5", label: "Intermediate" },
  Advanced: { accent: "#1c5cab", label: "Advanced" },
} as const;

interface MapperLevelBadgeProps {
  info: MapperLevelInfo;
}

export function MapperLevelBadge({ info }: MapperLevelBadgeProps) {
  const { level, changesetsToNextLevel, progressToNextLevel, nextLevel } = info;
  const style = LEVEL_STYLE[level];
  const isMaxLevel = level === "Advanced";

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <div
        className={cn(
          "inline-flex items-center gap-1.5 self-start px-2 py-0.5 rounded-full border text-xs font-bold tracking-wide",
          isMaxLevel && "shadow-[0_0_10px_rgba(28,92,171,0.5)]"
        )}
        style={{ color: style.accent, borderColor: `${style.accent}66`, backgroundColor: `${style.accent}1a` }}
      >
        {isMaxLevel ? <Sparkles size={12} /> : <Award size={12} />}
        {style.label} Mapper
      </div>

      {!isMaxLevel && nextLevel && changesetsToNextLevel !== null && progressToNextLevel !== null && (
        <div className="flex flex-col gap-0.5">
          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: `${style.accent}26` }}
            role="progressbar"
            aria-valuenow={Math.round(progressToNextLevel * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress toward ${nextLevel} Mapper`}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, progressToNextLevel * 100))}%`, backgroundColor: style.accent }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">
            {changesetsToNextLevel.toLocaleString()} changesets to {nextLevel}!
          </span>
        </div>
      )}
    </div>
  );
}
