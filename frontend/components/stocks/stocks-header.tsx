import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StockSearchItem } from '@/lib/stocks-types';

type StocksHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  searching: boolean;
  results: StockSearchItem[];
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
};

export function StocksHeader({
  query,
  onQueryChange,
  onSearch,
  searching,
  results,
  selectedTicker,
  onSelectTicker,
}: StocksHeaderProps) {
  return (
    <Card className="rounded-2xl border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Stock Search</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSearch();
                }
              }}
              placeholder="Search ticker or company (e.g. AAPL)"
              className="pl-10"
            />
          </div>
          <Button onClick={onSearch} disabled={searching || !query.trim()}>
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="rounded-xl border bg-accent/20 p-2">
            <div className="grid gap-1">
              {results.map((item) => {
                const isActive = selectedTicker === item.symbol;

                return (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => onSelectTicker(item.symbol)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-gradient-to-r from-[#dcfce7] to-[#cffafe] font-medium'
                        : 'hover:bg-background'
                    }`}
                  >
                    <span className="font-semibold">{item.symbol}</span>
                    <span className="truncate pl-3 text-foreground/70">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
