import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Loader2, TableIcon, LineChart as LineChartIcon, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useUsersConfig } from '@/hooks/useOSMData';
import { fetchUserMonthlyGrowth } from '@/lib/growthData';
import { formatFileTimestamp } from '@/lib/utils';

// Categorical palette (dark-mode steps, validated against this app's card
// surface with dataviz's scripts/validate_palette.js — all pass). Slot order
// is fixed: assigned by rank (slot 1 = current #1 by 3-year growth), never
// re-cycled. With ~26 users, only the top TOP_N get a distinct hue per the
// series-count ladder (7-8 is the token ceiling) — everyone else is shown as
// individual thin gray lines (still visible, not merged) rather than a 9th+
// generated hue.
const CATEGORICAL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const OTHER_COLOR = '#94a3b8';
const GRID_COLOR = '#242b42';
const AXIS_COLOR = '#94a3b8';
const TOP_N = 8;

interface GrowthChartProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SeriesEntry {
  username: string;
  scores: number[]; // aligned to `months`
  finalScore: number;
}

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadGrowthTableCsv(entries: SeriesEntry[]): void {
  const header = ['Rank', 'Username', 'Score (3y ago)', 'Score (now)', 'Growth'];
  const rows = entries.map((e, i) => [
    i + 1,
    e.username,
    e.scores[0],
    e.finalScore,
    e.finalScore - e.scores[0],
  ]);
  const csv = [header, ...rows].map(row => row.map(csvField).join(',')).join('\r\n') + '\r\n';

  const filename = `OSMLBtable_${formatFileTimestamp(new Date())}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function GrowthTooltip({ active, payload, label, topColors }: TooltipProps<number, string> & { topColors: Map<string, string> }) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload
    .filter(p => topColors.has(p.dataKey as string) && p.value != null)
    .sort((a, b) => (b.value as number) - (a.value as number));
  if (rows.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs min-w-[180px]">
      <div className="text-muted-foreground mb-2 font-medium">
        {format(parseISO(`${label}-01`), 'MMMM yyyy')}
      </div>
      {rows.map(r => (
        <div key={r.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block w-3 h-[2px] rounded-full shrink-0" style={{ backgroundColor: topColors.get(r.dataKey as string) }} />
            {r.dataKey}
          </span>
          <span className="font-mono font-semibold text-foreground tabular-nums">{(r.value as number).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export function GrowthChart({ open, onOpenChange }: GrowthChartProps) {
  const { data: config } = useUsersConfig();
  const users = useMemo(() => config?.users ?? [], [config]);
  const hashtags = useMemo(() => config?.hashtags ?? [], [config]);

  const [scale, setScale] = useState<'linear' | 'log'>('linear');
  const [view, setView] = useState<'chart' | 'table'>('chart');

  const queries = useQueries({
    queries: users.map(username => ({
      queryKey: ['userGrowth', username],
      queryFn: () => fetchUserMonthlyGrowth(username, hashtags),
      enabled: open && users.length > 0,
      staleTime: 30 * 60 * 1000,
      retry: 1,
    })),
  });

  const loadedCount = queries.filter(q => q.isSuccess).length;
  const isLoading = queries.some(q => q.isLoading);

  const { months, entries } = useMemo(() => {
    let months: string[] = [];
    const entries: SeriesEntry[] = [];
    users.forEach((username, i) => {
      const data = queries[i].data;
      if (!data || data.length === 0) return;
      if (months.length === 0) months = data.map(p => p.month);
      const scores = data.map(p => p.score);
      entries.push({ username, scores, finalScore: scores[scores.length - 1] });
    });
    entries.sort((a, b) => b.finalScore - a.finalScore);
    return { months, entries };
  }, [queries, users]);

  const topEntries = entries.slice(0, TOP_N);
  const otherEntries = entries.slice(TOP_N);
  const topColors = useMemo(() => new Map(topEntries.map((e, i) => [e.username, CATEGORICAL[i]])), [topEntries]);

  const chartData = useMemo(() => {
    return months.map((month, i) => {
      const row: Record<string, string | number | null> = { month };
      for (const e of entries) {
        const raw = e.scores[i];
        row[e.username] = scale === 'log' && raw <= 0 ? null : raw;
      }
      return row;
    });
  }, [months, entries, scale]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>3-Year Growth — Cumulative TOTAL SCORE</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <ToggleGroup
            type="single"
            value={scale}
            onValueChange={(v) => v && setScale(v as 'linear' | 'log')}
          >
            <ToggleGroupItem value="linear" className="text-xs px-3 h-8">Linear</ToggleGroupItem>
            <ToggleGroupItem value="log" className="text-xs px-3 h-8">Log</ToggleGroupItem>
          </ToggleGroup>

          <div className="flex items-center gap-3">
            {isLoading && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 size={13} className="animate-spin" />
                Loading {loadedCount}/{users.length} users…
              </span>
            )}
            {view === 'table' && (
              <button
                onClick={() => downloadGrowthTableCsv(entries)}
                disabled={entries.length === 0}
                className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Download table as CSV"
              >
                <Download size={16} />
              </button>
            )}
            <button
              onClick={() => setView(v => v === 'chart' ? 'table' : 'chart')}
              className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title={view === 'chart' ? 'Show data table' : 'Show chart'}
            >
              {view === 'chart' ? <TableIcon size={16} /> : <LineChartIcon size={16} />}
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="h-[420px] flex items-center justify-center text-sm text-muted-foreground">
            {isLoading ? 'Loading growth data…' : 'No data available.'}
          </div>
        ) : view === 'chart' ? (
          <>
            <ResponsiveContainer width="100%" height={420}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={(m: string) => format(parseISO(`${m}-01`), 'MMM yy')}
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  axisLine={{ stroke: GRID_COLOR }}
                  tickLine={false}
                  minTickGap={32}
                />
                <YAxis
                  scale={scale}
                  domain={scale === 'log' ? [1, 'auto'] : [0, 'auto']}
                  allowDataOverflow
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  axisLine={{ stroke: GRID_COLOR }}
                  tickLine={false}
                  width={56}
                  tickFormatter={(v: number) => v.toLocaleString()}
                />
                <Tooltip content={<GrowthTooltip topColors={topColors} />} />
                {otherEntries.map(e => (
                  <Line
                    key={e.username}
                    dataKey={e.username}
                    stroke={OTHER_COLOR}
                    strokeOpacity={0.35}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                ))}
                {topEntries.map(e => (
                  <Line
                    key={e.username}
                    dataKey={e.username}
                    stroke={topColors.get(e.username)}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: '#0e152a' }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
              {topEntries.map(e => (
                <div key={e.username} className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-[2px] rounded-full shrink-0" style={{ backgroundColor: topColors.get(e.username) }} />
                  <span className="text-muted-foreground">{e.username}</span>
                </div>
              ))}
              {otherEntries.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-[2px] rounded-full shrink-0" style={{ backgroundColor: OTHER_COLOR, opacity: 0.6 }} />
                  <span className="text-muted-foreground">Other {otherEntries.length} mappers (see table)</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="max-h-[480px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead className="text-right">Score (3y ago)</TableHead>
                  <TableHead className="text-right">Score (now)</TableHead>
                  <TableHead className="text-right">Growth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e, i) => (
                  <TableRow key={e.username}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{e.username}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{e.scores[0].toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{e.finalScore.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-primary">
                      +{(e.finalScore - e.scores[0]).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
