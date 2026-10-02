'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { adminGetBudgetsGoals } from '@/lib/admin-api';
import type { AdminBudgetRow } from '@/lib/admin-types';

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<AdminBudgetRow[]>([]);
  const [summary, setSummary] = useState<{ total_budgets: number; active_goals: number; over_budget_users: number; avg_savings_rate: string | number }>({ total_budgets: 0, active_goals: 0, over_budget_users: 0, avg_savings_rate: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const limit = 40;

  const fetchBudgets = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminGetBudgetsGoals({ page: pageNum, limit });
      setBudgets(res.budgets);
      setSummary(res.summary);
      setTotal(res.total);
      setTotalPages(res.total_pages);
      setPage(pageNum);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchBudgets(1); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Budgets & Goals</h2>
        <p className="text-sm text-foreground/50">{total.toLocaleString()} active budgets</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Budgets', value: summary.total_budgets },
          { label: 'Active Goals', value: summary.active_goals },
          { label: 'Over Budget Users', value: summary.over_budget_users, color: 'text-red-600' },
          { label: 'Avg Savings Rate', value: `${Number(summary.avg_savings_rate).toFixed(1)}%` },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-foreground/50 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${(s as { color?: string }).color || 'text-foreground'}`}>
              {s.value}
            </p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-accent/50">
                <th className="px-4 py-3 text-left font-medium text-foreground/60">User</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Category</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Period</th>
                <th className="px-4 py-3 text-right font-medium text-foreground/60">Limit (PKR)</th>
                <th className="px-4 py-3 text-right font-medium text-foreground/60">Spent (PKR)</th>
                <th className="px-4 py-3 text-right font-medium text-foreground/60">Utilization</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>)}
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  </tr>
                ))
              ) : budgets.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-foreground/40">No budgets found</td></tr>
              ) : (
                budgets.map((b) => {
                  const limit = Number(b.monthly_limit);
                  const spent = Number(b.spent || 0);
                  const pct = limit > 0 ? (spent / limit) * 100 : 0;
                  const over = pct > 100;
                  return (
                    <tr key={b.budget_id} className="border-b hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3 text-xs">{b.user_name || b.user_id}</td>
                      <td className="px-4 py-3 font-medium text-sm">{b.category_name}</td>
                      <td className="px-4 py-3 text-xs text-foreground/50 whitespace-nowrap">
                        {new Date(b.year, b.month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-right text-xs">{limit.toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right text-xs font-semibold ${over ? 'text-red-600' : 'text-foreground'}`}>
                        {spent.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(100, pct)}
                            className={`h-2 flex-1 ${over ? '[&>div]:bg-red-500' : pct > 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
                          />
                          <span className={`text-xs font-medium w-10 text-right ${over ? 'text-red-600' : 'text-foreground/60'}`}>
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`${over ? 'bg-red-100 text-red-700' : pct > 80 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'} text-xs`}>
                          {over ? 'Over' : pct > 80 ? 'Warning' : 'OK'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-foreground/50">
              {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void fetchBudgets(page - 1)} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center text-sm px-3">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => void fetchBudgets(page + 1)} disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
