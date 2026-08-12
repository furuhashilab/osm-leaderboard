import { useState } from 'react';
import { Leaderboard } from '@/components/Leaderboard';
import { MapPanel } from '@/components/MapPanel';
import { PeriodTabs } from '@/components/PeriodTabs';
import { Period, UserStats } from '@/types';
import { RefreshCw, Map as MapIcon, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

export default function Home() {
  const [period, setPeriod] = useState<Period>('Weekly');
  const [focusedUser, setFocusedUser] = useState<UserStats | undefined>();
  const [isMapOpenMobile, setIsMapOpenMobile] = useState(false);
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['userStats'] });
  };

  const handleViewMap = (stats: UserStats) => {
    setFocusedUser(stats);
    setIsMapOpenMobile(true);
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      
      {/* LEFT PANEL: Leaderboard */}
      <div className="w-full md:w-[60%] flex flex-col h-full z-10 relative">
        <header className="flex flex-col gap-4 p-4 md:p-6 border-b border-border bg-card/50 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter bg-gradient-to-br from-primary to-blue-600 bg-clip-text text-transparent">
                OSM LEADERBOARD
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Contributor editing achievements</p>
            </div>
            
            <button 
              onClick={handleRefresh}
              className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh Data"
            >
              <RefreshCw size={20} />
            </button>
          </div>
          
          <PeriodTabs activePeriod={period} onChange={setPeriod} />
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 custom-scrollbar">
          <Leaderboard period={period} onViewMap={handleViewMap} />
        </div>
        
        {/* Mobile Map Toggle */}
        <div className="md:hidden absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
          <button 
            onClick={() => setIsMapOpenMobile(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-full shadow-lg shadow-primary/20"
          >
            <MapIcon size={18} />
            Show Map
          </button>
        </div>
      </div>

      {/* RIGHT PANEL: Map */}
      <div className={cn(
        "fixed inset-0 z-40 md:relative md:w-[40%] md:block md:z-0 transition-transform duration-300",
        isMapOpenMobile ? "translate-y-0" : "translate-y-full md:translate-y-0"
      )}>
        {/* Mobile close button */}
        <button 
          onClick={() => setIsMapOpenMobile(false)}
          className="md:hidden absolute top-4 right-4 z-50 p-2 bg-background/80 backdrop-blur border border-border rounded-full shadow-lg"
        >
          <X size={20} className="text-foreground" />
        </button>
        
        <MapPanel focusedUser={focusedUser} />
      </div>
      
    </div>
  );
}
