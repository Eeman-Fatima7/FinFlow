import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney, usePreferences } from '@/lib/preferences';
import type { StockProfile } from '@/lib/stocks-types';

type StocksOverviewCardProps = {
  profile: StockProfile | null;
  loading: boolean;
};

const resolveCurrency = (value: string, fallback = 'USD') => {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return code || fallback;
};

const formatNumber = (value: number | null, fractionDigits = 2) => {
  if (value === null || Number.isNaN(Number(value))) return 'N/A';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

export function StocksOverviewCard({ profile, loading }: StocksOverviewCardProps) {
  const { preferences } = usePreferences();

  const formatCurrency = (value: number | null, currencyCode: string) => {
    if (value === null || Number.isNaN(Number(value))) return 'N/A';
    const currency = resolveCurrency(currencyCode, 'USD');
    return formatMoney(value, currency, preferences.language);
  };

  if (loading) {
    return (
      <Card className="rounded-2xl border-2">
        <CardContent className="py-10 text-sm text-foreground/60">Loading stock profile...</CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className="rounded-2xl border-2">
        <CardContent className="py-10 text-sm text-foreground/60">Select a stock to view profile details.</CardContent>
      </Card>
    );
  }

  const change = profile.daily_change_percent;
  const positive = typeof change === 'number' && change >= 0;

  return (
    <Card className="rounded-2xl border-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">{profile.symbol}</div>
            <p className="mt-1 text-sm font-normal text-foreground/70">{profile.company_name}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatCurrency(profile.current_price, profile.price_currency)}</div>
            <div className={`mt-1 inline-flex items-center gap-1 text-sm font-medium ${
              positive ? 'text-green-600' : 'text-red-600'
            }`}>
              {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {change === null ? 'N/A' : `${formatNumber(change, 2)}%`}
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground/75">{profile.description || 'No description available.'}</p>

        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div className="rounded-xl bg-accent/30 p-3">
            <div className="text-xs text-foreground/60">Sector</div>
            <div className="mt-1 font-medium">{profile.sector || 'N/A'}</div>
          </div>
          <div className="rounded-xl bg-accent/30 p-3">
            <div className="text-xs text-foreground/60">CEO</div>
            <div className="mt-1 font-medium">{profile.ceo || 'N/A'}</div>
          </div>
          <div className="rounded-xl bg-accent/30 p-3">
            <div className="text-xs text-foreground/60">Market Cap</div>
            <div className="mt-1 font-medium">{profile.market_cap || 'N/A'}</div>
          </div>
          <div className="rounded-xl bg-accent/30 p-3">
            <div className="text-xs text-foreground/60">Volume</div>
            <div className="mt-1 font-medium">{profile.volume || 'N/A'}</div>
          </div>
          <div className="rounded-xl bg-accent/30 p-3">
            <div className="text-xs text-foreground/60">P/E</div>
            <div className="mt-1 font-medium">{formatNumber(profile.pe, 2)}</div>
          </div>
          <div className="rounded-xl bg-accent/30 p-3">
            <div className="text-xs text-foreground/60">EPS</div>
            <div className="mt-1 font-medium">{formatNumber(profile.eps, 2)}</div>
          </div>
          <div className="rounded-xl bg-accent/30 p-3">
            <div className="text-xs text-foreground/60">Dividend Yield</div>
            <div className="mt-1 font-medium">{formatNumber(profile.dividend_yield, 4)}</div>
          </div>
          <div className="rounded-xl bg-accent/30 p-3">
            <div className="text-xs text-foreground/60">Daily Change</div>
            <div className="mt-1 font-medium">{formatNumber(profile.daily_change, 2)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
