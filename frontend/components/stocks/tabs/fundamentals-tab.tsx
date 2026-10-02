import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StockFundamentalRow } from '@/lib/stocks-types';

type FundamentalsTabProps = {
  statement: 'income' | 'balance' | 'cashflow';
  rows: StockFundamentalRow[];
  loading: boolean;
};

const statementLabel = {
  income: 'Income Statement',
  balance: 'Balance Sheet',
  cashflow: 'Cashflow Statement',
};

const resolveYearColumns = (rows: StockFundamentalRow[]) => {
  const first = rows[0] || {};
  return Object.keys(first).filter((key) => key.startsWith('fy_'));
};

const formatGrowth = (value: number | null) => {
  if (value === null || Number.isNaN(Number(value))) return 'N/A';
  return `${Number(value.toFixed(2))}%`;
};

export function FundamentalsTab({ statement, rows, loading }: FundamentalsTabProps) {
  if (loading) {
    return (
      <Card className="rounded-2xl border-2">
        <CardContent className="py-8 text-sm text-foreground/60">Loading fundamentals...</CardContent>
      </Card>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <Card className="rounded-2xl border-2">
        <CardHeader>
          <CardTitle>{statementLabel[statement]}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-foreground/60">No fundamentals data available.</CardContent>
      </Card>
    );
  }

  const yearColumns = resolveYearColumns(rows);

  return (
    <Card className="rounded-2xl border-2">
      <CardHeader>
        <CardTitle>{statementLabel[statement]}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3 font-medium">Metric</th>
                {yearColumns.map((yearKey) => (
                  <th key={yearKey} className="py-2 px-3 font-medium uppercase">
                    {yearKey.replace('_', ' ')}
                  </th>
                ))}
                <th className="py-2 pl-3 font-medium">Growth</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.metric} className="border-b last:border-b-0">
                  <td className="py-2 pr-3 font-medium">{row.metric}</td>
                  {yearColumns.map((yearKey) => (
                    <td key={`${row.metric}-${yearKey}`} className="py-2 px-3 text-foreground/80">
                      {typeof row[yearKey] === 'string' ? row[yearKey] : 'N/A'}
                    </td>
                  ))}
                  <td className="py-2 pl-3">{formatGrowth(row.growth_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
