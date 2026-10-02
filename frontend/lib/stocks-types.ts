export type StockSearchItem = {
  symbol: string;
  name: string;
};

export type StocksApiResponse<T> = {
  data: T;
  correlation_id?: string;
};

export type StockProfile = {
  symbol: string;
  company_name: string;
  price_currency: string;
  sector: string | null;
  description: string | null;
  ceo: string | null;
  current_price: number | null;
  daily_change: number | null;
  daily_change_percent: number | null;
  market_cap: string | null;
  volume: string | null;
  pe: number | null;
  eps: number | null;
  dividend_yield: number | null;
};

export type StockOverview = {
  day_change_pct: number | null;
  week_change_pct: number | null;
  month_change_pct: number | null;
  quarter_change_pct: number | null;
};

export type StockIndicators = {
  rsi: number | null;
  macd_trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  price_currency: string;
  fifty_two_week_low: number | null;
  fifty_two_week_high: number | null;
};

export type StockFundamentalRow = {
  metric: string;
  growth_pct: number | null;
  [key: string]: string | number | null;
};

export type StockInsight = {
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
