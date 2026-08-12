import { Period } from "@/types";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface PeriodTabsProps {
  activePeriod: Period;
  onChange: (period: Period) => void;
}

const periods: Period[] = ['Daily', 'Weekly', 'Monthly', 'Yearly', 'All Time'];

export function PeriodTabs({ activePeriod, onChange }: PeriodTabsProps) {
  return (
    <div className="flex p-1 bg-card rounded-xl border border-card-border overflow-x-auto no-scrollbar">
      {periods.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            "relative px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-1 text-center",
            activePeriod === p ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {activePeriod === p && (
            <motion.div
              layoutId="active-tab"
              className="absolute inset-0 bg-primary rounded-lg z-0 shadow-[0_0_10px_rgba(14,165,233,0.5)]"
              initial={false}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative z-10">{p}</span>
        </button>
      ))}
    </div>
  );
}
