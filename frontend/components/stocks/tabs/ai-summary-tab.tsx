import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatMoney, usePreferences } from '@/lib/preferences';

type StockAiSummary = {
  action: 'BUY' | 'HOLD' | 'SELL';
  target_price: number | null;
  target_price_currency: string;
  potential_pct: number | null;
  confidence_pct: number;
  summary: string;
  rationale: string[];
  as_of: string;
  model_fallback_used?: boolean;
};

type AiSummaryTabProps = {
  ticker: string | null;
  insights: StockAiSummary | null;
  loading: boolean;
  onGenerate: () => void;
};

const formatNumber = (value: number | null, digits = 2) => {
  if (value === null || Number.isNaN(Number(value))) return 'N/A';
  return Number(value).toFixed(digits);
};

const resolveCurrency = (value: string, fallback = 'USD') => {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return code || fallback;
};

const actionClass = (action: StockAiSummary['action']) => {
  if (action === 'BUY') return 'text-green-600';
  if (action === 'SELL') return 'text-red-600';
  return 'text-foreground';
};

export function AiSummaryTab({ ticker, insights, loading, onGenerate }: AiSummaryTabProps) {
  const { preferences } = usePreferences();

  const formatCurrency = (value: number | null, currencyCode: string) => {
    if (value === null || Number.isNaN(Number(value))) return 'N/A';
    const currency = resolveCurrency(currencyCode, 'USD');
    return formatMoney(value, currency, preferences.language);
  };

  return (
    <Card className="rounded-2xl border-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>AI Summary</CardTitle>
        <Button onClick={onGenerate} disabled={loading || !ticker}>
          {loading ? 'Generating...' : 'Generate Insight'}
        </Button>
      </CardHeader>
      <CardContent>
        {!ticker ? (
          <p className="text-sm text-foreground/60">Select a stock ticker to generate AI insight.</p>
        ) : !insights ? (
          <p className="text-sm text-foreground/60">No insight generated yet for {ticker}.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-accent/30 p-3">
                <div className="text-xs text-foreground/60">Action</div>
                <div className={`mt-1 text-xl font-semibold ${actionClass(insights.action)}`}>
                  {insights.action}
                </div>
              </div>
              <div className="rounded-xl bg-accent/30 p-3">
                <div className="text-xs text-foreground/60">Target Price</div>
                <div className="mt-1 text-xl font-semibold">{formatCurrency(insights.target_price, insights.target_price_currency)}</div>
              </div>
              <div className="rounded-xl bg-accent/30 p-3">
                <div className="text-xs text-foreground/60">Potential</div>
                <div className="mt-1 text-xl font-semibold">{formatNumber(insights.potential_pct, 2)}%</div>
              </div>
              <div className="rounded-xl bg-accent/30 p-3">
                <div className="text-xs text-foreground/60">Confidence</div>
                <div className="mt-1 text-xl font-semibold">{formatNumber(insights.confidence_pct, 1)}%</div>
              </div>
            </div>

            <p className="text-sm text-foreground/80">{insights.summary}</p>

            {insights.rationale?.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/80">
                {insights.rationale.map((item, idx) => (
                  <li key={`${idx}-${item}`}>{item}</li>
                ))}
              </ul>
            )}

            <div className="text-xs text-foreground/50">
              As of: {new Date(insights.as_of).toLocaleString('en-US')}
              {insights.model_fallback_used ? ' • fallback summary used' : ''}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
