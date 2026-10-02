'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { motion } from 'motion/react';
import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Target,
  TrendingUp,
} from 'lucide-react';
import { ApiError, apiRequest } from '@/lib/api';
import type { AnomalySummary } from '@/lib/anomaly-types';
import { formatMoney, getLocaleForLanguage, usePreferences } from '@/lib/preferences';
import { getCategoryColor as resolveCategoryColor } from '@/lib/categories';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ForecastProjection = {
  year: number;
  month: number;
  predicted_total_expenses: number;
  predicted_total_income: number;
  predicted_total_savings: number;
  savings_rate: number;
};

type ForecastReliability = {
  history_months_available: number;
  history_months_used: number;
  used_profile_income_fallback: boolean;
  fallback_mode: string;
  confidence_level: string;
  quality_flags: string[];
};

type ForecastCategoryOutlook = {
  category: string;
  predicted_monthly_spend: number;
};

type Forecast = {
  user_id: number;
  month: number;
  year: number;
  predicted_total_expenses: number;
  predicted_total_savings: number;
  savings_rate: number;
  method: string;
  based_on_records: number;
  horizon_months?: number;
  projections?: ForecastProjection[];
  reliability?: ForecastReliability;
  category_outlook?: ForecastCategoryOutlook[];
};

type SummaryCategory = {
  category: string;
  icon?: string | null;
  color?: string | null;
  amount: number;
  percentage: number;
};

type SummaryRecentTransaction = {
  transaction_id: number;
  description: string;
  merchant: string | null;
  amount: string | number;
  type: 'income' | 'expense';
  date: string;
  category_name?: string | null;
};

type SummaryResponse = {
  month: number;
  year: number;
  income: number;
  total_expenses: number;
  savings: number;
  savings_rate: number;
  category_breakdown: SummaryCategory[];
  recent_transactions: SummaryRecentTransaction[];
  forecast: Forecast | null;
  anomaly_summary?: AnomalySummary;
};

type BudgetApi = {
  category_name: string;
  category_color?: string | null;
  monthly_limit: string | number;
  spent: string | number;
};

type BudgetsResponse = {
  budgets: BudgetApi[];
};

type TransactionApi = {
  amount: string | number;
  type: 'income' | 'expense';
};

type TransactionsResponse = {
  transactions: TransactionApi[];
  total: number;
};

type SpendingRange = '1m' | '2m' | '3m' | '6m' | '12m' | 'all';

type TrendPoint = {
  month: string;
  amount: number;
};

type CategoryCard = {
  name: string;
  amount: number;
  budget: number;
  progressPercent: number;
  color: string;
  lightColor: string;
};

const rangeMonthCount: Record<SpendingRange, number> = {
  '1m': 1,
  '2m': 2,
  '3m': 3,
  '6m': 6,
  '12m': 12,
  all: 12,
};


const formatDateLabel = (dateValue: string, locale: string) => {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return dateValue;
  return parsed.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const toNumber = (value: string | number | null | undefined) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toLightColor = (color: string) => {
  if (color.startsWith('#') && color.length === 7) {
    return `${color}26`;
  }
  return '#f3f4f6';
};

const getRangeMonths = (range: SpendingRange, locale: string) => {
  const count = rangeMonthCount[range];
  const now = new Date();
  const months: Array<{ month: number; year: number; label: string }> = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    months.push({
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      label: d.toLocaleDateString(locale, { month: 'short' }),
    });
  }

  return months;
};

export default function DashboardPage() {
  const { preferences } = usePreferences();
  const locale = getLocaleForLanguage(preferences.language);
  const moneyFormatter = (value: number) =>
    formatMoney(Math.round(value || 0), preferences.currency, preferences.language);

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [budgets, setBudgets] = useState<BudgetApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spendingRange, setSpendingRange] = useState<SpendingRange>('6m');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    try {
      const [summaryData, budgetsData] = await Promise.all([
        apiRequest<SummaryResponse>('/dashboard/summary', {
          method: 'GET',
          auth: true,
          query: { month, year },
        }),
        apiRequest<BudgetsResponse>('/budgets', {
          method: 'GET',
          auth: true,
          query: { month, year },
        }).catch(() => ({ budgets: [] })),
      ]);

      setSummary(summaryData);
      setBudgets(budgetsData.budgets || []);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendData = async (range: SpendingRange, activeLocale: string) => {
    setTrendLoading(true);

    try {
      const months = getRangeMonths(range, activeLocale);

      const points = await Promise.all(
        months.map(async ({ month, year, label }) => {
          const data = await apiRequest<TransactionsResponse>('/transactions', {
            method: 'GET',
            auth: true,
            query: { month, year, limit: 500, offset: 0 },
          });

          const amount = (data.transactions || []).reduce((sum, txn) => {
            if (txn.type !== 'expense') return sum;
            return sum + Math.abs(toNumber(txn.amount));
          }, 0);

          return {
            month: label,
            amount: Math.round(amount),
          };
        })
      );

      setTrendData(points);
    } catch {
      setTrendData([]);
    } finally {
      setTrendLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboardData();
  }, []);

  useEffect(() => {
    void fetchTrendData(spendingRange, locale);
  }, [spendingRange, locale]);

  const budgetLookup = useMemo(() => {
    const map = new Map<string, BudgetApi>();
    budgets.forEach((budget) => {
      map.set(budget.category_name.toLowerCase(), budget);
    });
    return map;
  }, [budgets]);

  const categoryCards = useMemo(() => {
    const rows = summary?.category_breakdown || [];

    return rows
      .map((row) => {
        const fallbackColor = resolveCategoryColor(row.category);
        const linkedBudget = budgetLookup.get(row.category.toLowerCase());

        const amount = Math.round(toNumber(row.amount));
        const budgetLimit = Math.round(
          linkedBudget ? toNumber(linkedBudget.monthly_limit) : amount
        );
        const spent = linkedBudget ? Math.round(toNumber(linkedBudget.spent)) : amount;

        const safeBudget = budgetLimit > 0 ? budgetLimit : amount;
        const progressPercent = safeBudget > 0 ? Math.min(100, Math.round((spent / safeBudget) * 100)) : 0;

        const color = row.color || linkedBudget?.category_color || fallbackColor;

        return {
          name: row.category,
          amount,
          budget: safeBudget,
          progressPercent,
          color,
          lightColor: toLightColor(color),
        } satisfies CategoryCard;
      })
      .sort((a, b) => b.amount - a.amount);
  }, [summary, budgetLookup]);

  useEffect(() => {
    if (selectedCategory === 'All') return;
    const stillExists = categoryCards.some((item) => item.name === selectedCategory);
    if (!stillExists) {
      setSelectedCategory('All');
    }
  }, [categoryCards, selectedCategory]);

  const filteredCategories = useMemo(() => {
    if (selectedCategory === 'All') return categoryCards;
    return categoryCards.filter((category) => category.name === selectedCategory);
  }, [categoryCards, selectedCategory]);

  const recentTransactions = useMemo(() => {
    const rows = summary?.recent_transactions || [];

    return rows.map((txn) => {
      const rawAmount = Math.abs(toNumber(txn.amount));
      const signedAmount = txn.type === 'income' ? rawAmount : -rawAmount;
      const category = txn.category_name || 'Other';

      return {
        id: txn.transaction_id,
        name: txn.merchant || txn.description || 'Transaction',
        amount: signedAmount,
        category,
        date: formatDateLabel(txn.date, locale),
        color: resolveCategoryColor(category),
      };
    });
  }, [summary, locale]);

  const donutData = useMemo(() => {
    if (!summary) return [];

    const top = categoryCards.slice(0, 3).map((category) => ({
      name: category.name,
      value: category.amount,
      color: category.color,
    }));

    const topTotal = top.reduce((sum, item) => sum + item.value, 0);
    const otherSpend = Math.max(0, Math.round(summary.total_expenses) - topTotal);

    const segments = [
      { name: 'Income', value: Math.max(0, Math.round(summary.income)), color: '#86efac' },
      ...top,
    ];

    if (otherSpend > 0) {
      segments.push({ name: 'Other Spend', value: otherSpend, color: '#f9a8d4' });
    }

    return segments;
  }, [summary, categoryCards]);

  const cashflowData = useMemo(
    () => [
      { name: 'Income', amount: Math.round(summary?.income || 0) },
      { name: 'Expenses', amount: Math.round(summary?.total_expenses || 0) },
      { name: 'Savings', amount: Math.round(summary?.savings || 0) },
    ],
    [summary]
  );

  const leftThisMonth = Math.round((summary?.income || 0) - (summary?.total_expenses || 0));
  const daysRemaining = useMemo(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Math.max(1, lastDay - now.getDate() + 1);
  }, []);
  const dailyBudget = leftThisMonth / daysRemaining;

  if (loading) {
    return <div className="rounded-xl border bg-white p-6 text-sm text-zinc-500">Loading dashboard...</div>;
  }

  if (error || !summary) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <p className="text-sm text-red-600">{error || 'Dashboard data unavailable'}</p>
        <button className="mt-3 rounded-md border px-3 py-1.5 text-sm" onClick={() => void fetchDashboardData()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1320px] mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">This Month Income</span>
              <div className="w-10 h-10 rounded-xl bg-[#dcfce7] flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-[#16a34a]" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-2">{moneyFormatter(summary.income)}</div>
            <div className="text-sm text-foreground/60">From recorded transactions</div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">This Month Expenses</span>
              <div className="w-10 h-10 rounded-xl bg-[#f3e8ff] flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5 text-[#9333ea]" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-2">{moneyFormatter(summary.total_expenses)}</div>
            <div className="text-sm text-foreground/60">All expense categories</div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">Net Savings</span>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-2">{moneyFormatter(summary.savings)}</div>
            <div className="text-sm text-foreground/60">Income minus expenses</div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">Savings Rate</span>
              <div className="w-10 h-10 rounded-xl bg-[#dbeafe] flex items-center justify-center">
                <Target className="w-5 h-5 text-[#2563eb]" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-2">{summary.savings_rate}%</div>
            <div className="text-sm text-foreground/60">Target benchmark: 20%</div>
          </Card>
        </motion.div>
      </div>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Next month forecast</h2>
        {summary.forecast ? (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-zinc-50 p-4">
              <p className="text-xs text-zinc-500">Predicted expenses</p>
              <p className="mt-1 text-xl font-semibold">{moneyFormatter(summary.forecast.predicted_total_expenses)}</p>
            </div>
            <div className="rounded-xl border bg-zinc-50 p-4">
              <p className="text-xs text-zinc-500">Predicted savings</p>
              <p className="mt-1 text-xl font-semibold">{moneyFormatter(summary.forecast.predicted_total_savings)}</p>
            </div>
            <div className="rounded-xl border bg-zinc-50 p-4">
              <p className="text-xs text-zinc-500">Predicted savings rate</p>
              <p className="mt-1 text-xl font-semibold">{summary.forecast.savings_rate}%</p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">Forecast data unavailable right now.</p>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Anomaly alerts</h2>
          <span className="text-xs text-zinc-500">Active: {summary.anomaly_summary?.total_active || 0}</span>
        </div>

        {summary.anomaly_summary && summary.anomaly_summary.total_active > 0 ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {summary.anomaly_summary.high_count > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-700">
                  High {summary.anomaly_summary.high_count}
                </span>
              )}
              {summary.anomaly_summary.medium_count > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                  Medium {summary.anomaly_summary.medium_count}
                </span>
              )}
              {summary.anomaly_summary.low_count > 0 && (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">
                  Low {summary.anomaly_summary.low_count}
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {(summary.anomaly_summary.highlights || []).slice(0, 5).map((alert) => (
                <div key={alert.anomaly_id} className="rounded-xl border bg-zinc-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        alert.severity === 'high'
                          ? 'bg-red-100 text-red-700'
                          : alert.severity === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {String(alert.severity || 'low').toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{alert.explanation}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No active anomaly alerts for this month.</p>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Cashflow snapshot</h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashflowData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
              <Tooltip formatter={(value) => moneyFormatter(Number(value || 0))} />
              <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                {cashflowData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.name === 'Income' ? '#0f766e' : entry.name === 'Expenses' ? '#dc2626' : '#2563eb'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-xs text-zinc-500">Income vs expense vs savings for current summary month.</p>
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-1"
        >
          <Card className="p-6 rounded-3xl border-2 h-full">
            <h3 className="text-lg font-semibold mb-6">Left This Month</h3>

            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300, delay: 0.3 }}
              >
                <motion.div
                  className="text-2xl font-bold text-center px-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                >
                  {moneyFormatter(leftThisMonth)}
                </motion.div>
                <motion.div
                  className="text-sm text-foreground/60"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                >
                  available
                </motion.div>
              </motion.div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="bg-[#dcfce7] rounded-2xl p-4">
                <div className="text-xs text-foreground/60 mb-1">Daily Budget</div>
                <div className="text-2xl font-bold">{moneyFormatter(dailyBudget)}</div>
                <div className="text-xs text-foreground/60 mt-1">{daysRemaining} days remaining</div>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2"
        >
          <Card className="p-6 rounded-3xl border-2 h-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Spending Trend</h3>
              <Select value={spendingRange} onValueChange={(value) => setSpendingRange(value as SpendingRange)}>
                <SelectTrigger className="w-[160px] h-9 rounded-xl text-sm border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1m">Last 1 month</SelectItem>
                  <SelectItem value="2m">Last 2 months</SelectItem>
                  <SelectItem value="3m">Last 3 months</SelectItem>
                  <SelectItem value="6m">Last 6 months</SelectItem>
                  <SelectItem value="12m">Last 12 months</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {trendLoading ? (
              <p className="text-sm text-foreground/60">Loading trend...</p>
            ) : trendData.length === 0 ? (
              <p className="text-sm text-foreground/60">No trend data available.</p>
            ) : (
              <div className="overflow-x-hidden">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trendData}>
                    <defs>
                      <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#86efac" />
                        <stop offset="50%" stopColor="#67e8f9" />
                        <stop offset="100%" stopColor="#93c5fd" />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#71717a', fontSize: 12 }}
                      tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '8px 12px',
                      }}
                      formatter={(value) => [moneyFormatter(Number(value || 0)), 'Expenses']}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="url(#lineGradient)"
                      strokeWidth={3}
                      dot={{ fill: '#67e8f9', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Category Breakdown</h3>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select a category">{selectedCategory}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                {categoryCards.map((category) => (
                  <SelectItem key={category.name} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredCategories.length === 0 ? (
            <p className="text-sm text-foreground/60">No category data available for this month.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredCategories.map((category, index) => (
                <motion.div
                  key={category.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.08 }}
                >
                  <Card className="p-5 rounded-2xl border hover:shadow-md transition-shadow" style={{ backgroundColor: category.lightColor }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-white" style={{ backgroundColor: category.color }}>
                        {category.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium" style={{ color: category.color }}>
                        {category.progressPercent}%
                      </span>
                    </div>
                    <div className="text-sm text-foreground/70 mb-1">{category.name}</div>
                    <div className="text-xl font-bold mb-2">{moneyFormatter(category.amount)}</div>
                    <div className="text-xs text-foreground/60">of {moneyFormatter(category.budget)} budget</div>
                    <div className="w-full bg-white rounded-full h-1.5 mt-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(category.progressPercent, 100)}%`,
                          backgroundColor: category.color,
                        }}
                      />
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
            <Link href="/dashboard/transactions" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>

          {recentTransactions.length === 0 ? (
            <p className="text-sm text-foreground/60">No recent transactions found.</p>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((transaction, index) => (
                <motion.div
                  key={transaction.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + index * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-2xl hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-sm"
                      style={{ backgroundColor: transaction.color }}
                    >
                      {transaction.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{transaction.name}</div>
                      <div className="text-sm text-foreground/60">
                        {transaction.category} • {transaction.date}
                      </div>
                    </div>
                  </div>
                  <div className={`text-lg font-semibold ${transaction.amount > 0 ? 'text-[#16a34a]' : 'text-foreground'}`}>
                    {transaction.amount > 0 ? '+' : '-'}{moneyFormatter(Math.abs(transaction.amount))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
        <Card className="p-6 rounded-3xl border-2 bg-gradient-to-br from-[#dcfce7] to-[#cffafe]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-semibold">Live data connected</h4>
              <p className="text-sm text-foreground/70 mt-1">
                Dashboard cards, trends, categories, and recent transactions now render from API responses.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
