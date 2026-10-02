import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney, resolveCurrency, usePreferences } from '@/lib/preferences';
import type { StockIndicators } from '@/lib/stocks-types';

type IndicatorsTabProps = {
  indicators: StockIndicators | null;
  loading: boolean;
};

const formatValue = (value: number | null) => {
  if (value === null || Number.isNaN(Number(value))) return 'N/A';
  return Number(value.toFixed(2)).toLocaleString('en-US');
};



const trendClass = (value: StockIndicators['macd_trend']) => {
  if (value === 'BULLISH') return 'text-green-600';
  if (value === 'BEARISH') return 'text-red-600';
  return 'text-foreground';
};

export function IndicatorsTab({ indicators, loading }: IndicatorsTabProps) {
  const { preferences } = usePreferences();

  const formatCurrency = (value: number | null, currencyCode: string) => {
    if (value === null || Number.isNaN(Number(value))) return 'N/A';
    const currency = resolveCurrency(currencyCode);
    return formatMoney(value, currency, preferences.language);
  };

  if (loading) {
    return (
      <Card className="rounded-2xl border-2">
        <CardContent className="py-8 text-sm text-foreground/60">Loading indicators...</CardContent>
      </Card>
    );
  }

  if (!indicators) {
    return (
      <Card className="rounded-2xl border-2">
        <CardContent className="py-8 text-sm text-foreground/60">No indicators data available.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-2">
      <CardHeader>
        <CardTitle>Technical Indicators</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-accent/30 p-4">
            <div className="text-xs text-foreground/60">RSI</div>
            <div className="mt-2 text-xl font-semibold">{formatValue(indicators.rsi)}</div>
          </div>

          <div className="rounded-xl bg-accent/30 p-4">
            <div className="text-xs text-foreground/60">MACD Trend</div>
            <div className={`mt-2 text-xl font-semibold ${trendClass(indicators.macd_trend)}`}>
              {indicators.macd_trend}
            </div>
          </div>

          <div className="rounded-xl bg-accent/30 p-4">
            <div className="text-xs text-foreground/60">52W Low</div>
            <div className="mt-2 text-xl font-semibold">{formatCurrency(indicators.fifty_two_week_low, indicators.price_currency)}</div>
          </div>

          <div className="rounded-xl bg-accent/30 p-4">
            <div className="text-xs text-foreground/60">52W High</div>
            <div className="mt-2 text-xl font-semibold">{formatCurrency(indicators.fifty_two_week_high, indicators.price_currency)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
