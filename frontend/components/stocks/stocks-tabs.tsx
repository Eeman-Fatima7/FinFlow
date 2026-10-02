'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { StockFundamentalRow, StockIndicators, StockOverview } from '@/lib/stocks-types';
import { OverviewTab } from './tabs/overview-tab';
import { IndicatorsTab } from './tabs/indicators-tab';
import { FundamentalsTab } from './tabs/fundamentals-tab';

type StocksTabsProps = {
  overview: StockOverview | null;
  overviewLoading: boolean;
  indicators: StockIndicators | null;
  indicatorsLoading: boolean;
  selectedStatement: 'income' | 'balance' | 'cashflow';
  onStatementChange: (value: 'income' | 'balance' | 'cashflow') => void;
  fundamentalsRows: StockFundamentalRow[];
  fundamentalsLoading: boolean;
};

export function StocksTabs({
  overview,
  overviewLoading,
  indicators,
  indicatorsLoading,
  selectedStatement,
  onStatementChange,
  fundamentalsRows,
  fundamentalsLoading,
}: StocksTabsProps) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="mb-4 w-full justify-start md:w-fit">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="indicators">Indicators</TabsTrigger>
        <TabsTrigger value="fundamentals">Fundamentals</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab overview={overview} loading={overviewLoading} />
      </TabsContent>

      <TabsContent value="indicators">
        <IndicatorsTab indicators={indicators} loading={indicatorsLoading} />
      </TabsContent>

      <TabsContent value="fundamentals" className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onStatementChange('income')}
            className={`rounded-xl border px-3 py-1.5 text-sm ${
              selectedStatement === 'income'
                ? 'bg-gradient-to-r from-[#dcfce7] to-[#cffafe] font-medium'
                : 'bg-background hover:bg-accent'
            }`}
          >
            Income
          </button>
          <button
            type="button"
            onClick={() => onStatementChange('balance')}
            className={`rounded-xl border px-3 py-1.5 text-sm ${
              selectedStatement === 'balance'
                ? 'bg-gradient-to-r from-[#dcfce7] to-[#cffafe] font-medium'
                : 'bg-background hover:bg-accent'
            }`}
          >
            Balance
          </button>
          <button
            type="button"
            onClick={() => onStatementChange('cashflow')}
            className={`rounded-xl border px-3 py-1.5 text-sm ${
              selectedStatement === 'cashflow'
                ? 'bg-gradient-to-r from-[#dcfce7] to-[#cffafe] font-medium'
                : 'bg-background hover:bg-accent'
            }`}
          >
            Cashflow
          </button>
        </div>

        <FundamentalsTab
          statement={selectedStatement}
          rows={fundamentalsRows}
          loading={fundamentalsLoading}
        />
      </TabsContent>
    </Tabs>
  );
}
