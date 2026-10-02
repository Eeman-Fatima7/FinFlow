import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StockOverview } from '@/lib/stocks-types';

type OverviewTabProps = {
  overview: StockOverview | null;
  loading: boolean;
};

const formatPct = (value: number | null) => {
  if (value === null || Number.isNaN(Number(value))) return 'N/A';
  const rounded = Number(value.toFixed(2));
  return `${rounded}%`;
};

const getColor = (value: number | null) => {
  if (value === null) return 'text-foreground';
  return value >= 0 ? 'text-green-600' : 'text-red-600';
};

export function OverviewTab({ overview, loading }: OverviewTabProps) {
  if (loading) {
    return (
      <Card className="rounded-2xl border-2">
        <CardContent className="py-8 text-sm text-foreground/60">Loading overview...</CardContent>
      </Card>
    );
  }

  if (!overview) {
    return (
      <Card className="rounded-2xl border-2">
        <CardContent className="py-8 text-sm text-foreground/60">No overview data available.</CardContent>
      </Card>
    );
  }

  const items = [
    { label: '1 Day', value: overview.day_change_pct },
    { label: '1 Week', value: overview.week_change_pct },
    { label: '1 Month', value: overview.month_change_pct },
    { label: '1 Quarter', value: overview.quarter_change_pct },
  ];

  return (
    <Card className="rounded-2xl border-2">
      <CardHeader>
        <CardTitle>Performance Changes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="rounded-xl bg-accent/30 p-4">
              <div className="text-xs text-foreground/60">{item.label}</div>
              <div className={`mt-2 text-xl font-semibold ${getColor(item.value)}`}>
                {formatPct(item.value)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
