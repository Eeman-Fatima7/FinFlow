'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiRequest } from '@/lib/api';
import type {
  StockFundamentalRow,
  StockIndicators,
  StockInsight,
  StockOverview,
  StockProfile,
  StockSearchItem,
  StocksApiResponse,
} from '@/lib/stocks-types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StocksHeader } from '@/components/stocks/stocks-header';
import { StocksOverviewCard } from '@/components/stocks/stocks-overview-card';
import { StocksTabs } from '@/components/stocks/stocks-tabs';
import { AiSummaryTab } from '@/components/stocks/tabs/ai-summary-tab';

const DEFAULT_TICKER = 'AAPL';

export default function StocksPage() {
  const didAutoSearch = useRef(false);
  const [query, setQuery] = useState(DEFAULT_TICKER);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<StockSearchItem[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(DEFAULT_TICKER);

  const [profile, setProfile] = useState<StockProfile | null>(null);
  const [overview, setOverview] = useState<StockOverview | null>(null);
  const [indicators, setIndicators] = useState<StockIndicators | null>(null);
  const [fundamentalsRows, setFundamentalsRows] = useState<StockFundamentalRow[]>([]);
  const [insight, setInsight] = useState<StockInsight | null>(null);

  const [profileLoading, setProfileLoading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [indicatorsLoading, setIndicatorsLoading] = useState(false);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);

  const [selectedStatement, setSelectedStatement] = useState<'income' | 'balance' | 'cashflow'>('income');
  const [error, setError] = useState<string | null>(null);

  const handleApiError = (err: unknown, fallback: string) => {
    if (!(err instanceof ApiError)) return fallback;

    const body = err.data as
      | {
          error?: string;
          details?: {
            reason?: string;
          };
        }
      | null
      | undefined;

    const reason = body?.details?.reason;

    if (reason === 'not_subscribed') {
      return 'Stock data provider plan is not subscribed for this endpoint.';
    }

    if (reason === 'quota_exhausted') {
      return 'Stock data provider quota/rate limit is exhausted for the current plan.';
    }

    if (reason === 'invalid_api_key') {
      return 'Stock data provider API key is invalid or rejected.';
    }

    if (reason === 'provider_outage') {
      return 'Stock data provider is temporarily unavailable. Please retry shortly.';
    }

    return body?.error || err.message || fallback;
  };

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearching(true);
    setError(null);

    try {
      const response = await apiRequest<StocksApiResponse<StockSearchItem[]>>('/stocks/search', {
        method: 'GET',
        auth: true,
        query: { q: trimmed },
      });

      const rows = Array.isArray(response.data) ? response.data : [];
      setSearchResults(rows);

      if (rows.length > 0) {
        setSelectedTicker(rows[0].symbol);
      }
    } catch (err) {
      setError(handleApiError(err, 'Failed to search stocks'));
    } finally {
      setSearching(false);
    }
  }, [query]);

  const fetchProfile = useCallback(async (ticker: string) => {
    setProfileLoading(true);

    try {
      const response = await apiRequest<StocksApiResponse<StockProfile>>(`/stocks/${ticker}/profile`, {
        method: 'GET',
        auth: true,
      });
      setProfile(response.data || null);
    } catch (err) {
      setProfile(null);
      setError(handleApiError(err, 'Failed to load stock profile'));
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const fetchOverview = useCallback(async (ticker: string) => {
    setOverviewLoading(true);

    try {
      const response = await apiRequest<StocksApiResponse<StockOverview>>(`/stocks/${ticker}/overview`, {
        method: 'GET',
        auth: true,
      });
      setOverview(response.data || null);
    } catch (err) {
      setOverview(null);
      setError(handleApiError(err, 'Failed to load stock overview'));
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const fetchIndicators = useCallback(async (ticker: string) => {
    setIndicatorsLoading(true);

    try {
      const response = await apiRequest<StocksApiResponse<StockIndicators>>(`/stocks/${ticker}/indicators`, {
        method: 'GET',
        auth: true,
      });
      setIndicators(response.data || null);
    } catch (err) {
      setIndicators(null);
      setError(handleApiError(err, 'Failed to load stock indicators'));
    } finally {
      setIndicatorsLoading(false);
    }
  }, []);

  const fetchFundamentals = useCallback(async (ticker: string, statement: 'income' | 'balance' | 'cashflow') => {
    setFundamentalsLoading(true);

    try {
      const response = await apiRequest<StocksApiResponse<StockFundamentalRow[]>>(
        `/stocks/${ticker}/fundamentals`,
        {
          method: 'GET',
          auth: true,
          query: { statement },
        }
      );

      setFundamentalsRows(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setFundamentalsRows([]);
      setError(handleApiError(err, 'Failed to load stock fundamentals'));
    } finally {
      setFundamentalsLoading(false);
    }
  }, []);

  const generateInsight = useCallback(async () => {
    if (!selectedTicker) return;

    setInsightLoading(true);
    setError(null);

    try {
      const response = await apiRequest<StocksApiResponse<StockInsight>>(`/stocks/${selectedTicker}/insights`, {
        method: 'POST',
        auth: true,
      });

      setInsight(response.data || null);
    } catch (err) {
      setInsight(null);
      setError(handleApiError(err, 'Failed to generate stock insight'));
    } finally {
      setInsightLoading(false);
    }
  }, [selectedTicker]);

  useEffect(() => {
    if (!selectedTicker) return;

    setError(null);
    setInsight(null);

    void Promise.all([
      fetchProfile(selectedTicker),
      fetchOverview(selectedTicker),
      fetchIndicators(selectedTicker),
    ]);
  }, [selectedTicker, fetchProfile, fetchOverview, fetchIndicators]);

  useEffect(() => {
    if (!selectedTicker) return;
    void fetchFundamentals(selectedTicker, selectedStatement);
  }, [selectedTicker, selectedStatement, fetchFundamentals]);

  useEffect(() => {
    if (didAutoSearch.current) return;
    didAutoSearch.current = true;
    void runSearch();
  }, [runSearch]);

  const loadingAny = useMemo(
    () => profileLoading || overviewLoading || indicatorsLoading || fundamentalsLoading || insightLoading,
    [profileLoading, overviewLoading, indicatorsLoading, fundamentalsLoading, insightLoading]
  );

  return (
    <div className="mx-auto max-w-[1320px] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stocks</h1>
        <p className="mt-1 text-sm text-foreground/65">Fundamental analysis and technical indicators.</p>
      </div>

      {error && (
        <Card className="rounded-2xl border-2 border-red-200">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" onClick={() => selectedTicker && void fetchProfile(selectedTicker)}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <StocksHeader
        query={query}
        onQueryChange={setQuery}
        onSearch={runSearch}
        searching={searching}
        results={searchResults}
        selectedTicker={selectedTicker}
        onSelectTicker={setSelectedTicker}
      />

      <StocksOverviewCard profile={profile} loading={profileLoading} />

      <StocksTabs
        overview={overview}
        overviewLoading={overviewLoading}
        indicators={indicators}
        indicatorsLoading={indicatorsLoading}
        selectedStatement={selectedStatement}
        onStatementChange={setSelectedStatement}
        fundamentalsRows={fundamentalsRows}
        fundamentalsLoading={fundamentalsLoading}
      />

      <AiSummaryTab
        ticker={selectedTicker}
        insights={insight}
        loading={insightLoading}
        onGenerate={generateInsight}
      />

      {loadingAny && (
        <p className="text-xs text-foreground/50">Refreshing stock data...</p>
      )}
    </div>
  );
}
