'use client';

import { useEffect, useState } from 'react';
import { Brain, TrendingUp, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { adminGetForecasting } from '@/lib/admin-api';
import type { AdminForecastingResponse } from '@/lib/admin-types';

const statusColors: Record<string, string> = {
  ok: 'bg-emerald-100 text-emerald-700',
  degraded: 'bg-amber-100 text-amber-700',
  offline: 'bg-red-100 text-red-700',
  unknown: 'bg-slate-100 text-slate-600',
};

export default function ForecastingPage() {
  const [data, setData] = useState<AdminForecastingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminGetForecasting({ limit: 50 });
        setData(res);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load forecasting data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Forecasting</h2>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-white rounded-xl text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Forecasting</h2>
        <p className="text-sm text-foreground/50">ML forecasting service and user prediction profiles</p>
      </div>

      {/* ML Service Status */}
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            data.ml_service_status === 'ok' ? 'bg-emerald-100' : 'bg-red-100'
          }`}>
            <Brain className={`h-5 w-5 ${data.ml_service_status === 'ok' ? 'text-emerald-600' : 'text-red-600'}`} />
          </div>
          <div>
            <p className="text-sm font-medium">ML Forecasting Service</p>
            <Badge className={`${statusColors[data.ml_service_status] || 'bg-slate-100'} mt-1`}>
              {data.ml_service_status.toUpperCase()}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Monthly aggregates */}
      {data.monthly_aggregates.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground/60 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Monthly Aggregates
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium text-foreground/60">Period</th>
                  <th className="px-4 py-2 text-right font-medium text-foreground/60">User</th>
                  <th className="px-4 py-2 text-right font-medium text-foreground/60">Income (PKR)</th>
                  <th className="px-4 py-2 text-right font-medium text-foreground/60">Expenses (PKR)</th>
                  <th className="px-4 py-2 text-right font-medium text-foreground/60">Net</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly_aggregates.map((a, i) => {
                  const income = Number(a.total_income);
                  const expenses = Number(a.total_expenses);
                  const net = income - expenses;
                  return (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-4 py-2 text-xs whitespace-nowrap">
                        {a.year}/{String(a.month).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-2 text-xs text-foreground/50">{a.user_id}</td>
                      <td className="px-4 py-2 text-right text-emerald-600 font-medium">
                        {income.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right text-rose-600 font-medium">
                        {expenses.toLocaleString()}
                      </td>
                      <td className={`px-4 py-2 text-right font-bold ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {net >= 0 ? '+' : ''}{net.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* User profiles */}
      {data.users.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground/60 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4" /> User Forecast Profiles
          </h3>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.users.map((u) => (
              <div key={u.user_id} className="border rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm">{u.name}</p>
                    <p className="text-xs text-foreground/40">ID: {u.user_id}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {u.months_of_history} mo history
                  </Badge>
                </div>
                <div className="space-y-1 text-xs text-foreground/60">
                  <div className="flex justify-between">
                    <span>Income</span>
                    <span className="font-medium text-emerald-600">PKR {Number(u.monthly_income).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transactions</span>
                    <span className="font-medium">{u.transaction_count.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.users.length === 0 && data.monthly_aggregates.length === 0 && (
        <div className="text-center py-16 text-foreground/40">
          No forecasting data available yet
        </div>
      )}
    </div>
  );
}
