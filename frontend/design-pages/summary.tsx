"use client";

import { motion } from "motion/react";
import { Link } from "@/lib/react-router-shim";
import {
  TrendingUp,
  TrendingDown,
  Download,
  Share2,
  Calendar,
  DollarSign,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api";
import { getCategoryColor } from "@/lib/categories";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type ApiTransaction = {
  transaction_id: number;
  description: string;
  merchant: string | null;
  amount: string | number;
  type: "income" | "expense";
  date: string;
  category_name: string | null;
};

type TransactionsResponse = {
  transactions: ApiTransaction[];
  total: number;
};

type Transaction = {
  id: number;
  occurredAt: Date;
  merchant: string;
  category: string;
  amount: number;
  type: "income" | "expense";
  color: string;
};

type DatePreset = "7d" | "30d" | "3m" | "1y" | "all" | "custom";

type StackedCategory = {
  name: string;
  key: string;
  color: string;
};

type StackedMonthData = Record<string, number | string> & {
  month: string;
};

const formatPKR = (value: number) =>
  `PKR ${new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: 0,
  }).format(Math.round(Math.abs(value)) || 0)}`;

const parseDate = (value: string): Date | null => {
  const directMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (directMatch) {
    const [, y, m, d] = directMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const formatMonthDisplay = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-PK", { month: "long", year: "numeric" });
};

const formatMonthShort = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-PK", { month: "short", year: "2-digit" });
};

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const toChartKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const getPresetLabel = (preset: DatePreset) => {
  if (preset === "custom") return "Custom range";
  if (preset === "7d") return "Last 7 days";
  if (preset === "30d") return "Last 30 days";
  if (preset === "3m") return "Last 3 months";
  if (preset === "1y") return "Last year";
  return "All time";
};

export function Summary() {
  const [transactionsData, setTransactionsData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getMonthKey(new Date()));

  const fetchAllTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const pageSize = 500;
      let offset = 0;
      let total = Number.POSITIVE_INFINITY;
      const collected: ApiTransaction[] = [];

      while (offset < total) {
        const page = await apiRequest<TransactionsResponse>("/transactions", {
          method: "GET",
          auth: true,
          query: { limit: pageSize, offset },
        });

        const rows = page.transactions || [];
        collected.push(...rows);
        total = Number(page.total || 0);

        if (rows.length === 0) break;
        offset += pageSize;
      }

      const mapped = collected
        .map((txn) => {
          const occurredAt = parseDate(txn.date);
          if (!occurredAt) return null;

          const raw = Number(txn.amount);
          const numeric = Number.isFinite(raw) ? Math.abs(raw) : 0;
          const signedAmount = txn.type === "income" ? numeric : -numeric;
          const category = txn.category_name || "Other";

          return {
            id: txn.transaction_id,
            occurredAt,
            merchant: txn.merchant || txn.description || "Transaction",
            category,
            amount: signedAmount,
            type: txn.type,
            color: getCategoryColor(category),
          } satisfies Transaction;
        })
        .filter((tx): tx is Transaction => tx !== null)
        .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

      setTransactionsData(mapped);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load summary data");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAllTransactions();
  }, [fetchAllTransactions]);

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    let start = new Date(now);
    start.setHours(0, 0, 0, 0);

    if (datePreset === "custom" && customRange.from && customRange.to) {
      const from = parseDate(customRange.from);
      const to = parseDate(customRange.to);

      if (from && to) {
        start = new Date(from);
        start.setHours(0, 0, 0, 0);

        const customEnd = new Date(to);
        customEnd.setHours(23, 59, 59, 999);
        return { startDate: start, endDate: customEnd };
      }
    }

    if (datePreset === "7d") {
      start.setDate(start.getDate() - 6);
    } else if (datePreset === "30d") {
      start.setDate(start.getDate() - 29);
    } else if (datePreset === "3m") {
      start.setMonth(start.getMonth() - 2);
    } else if (datePreset === "1y") {
      start.setFullYear(start.getFullYear() - 1);
    } else if (datePreset === "all") {
      if (transactionsData.length > 0) {
        const earliest = transactionsData.reduce((min, tx) =>
          tx.occurredAt.getTime() < min.getTime() ? tx.occurredAt : min
        , transactionsData[0].occurredAt);
        start = new Date(earliest);
        start.setHours(0, 0, 0, 0);
      }
    }

    return { startDate: start, endDate: end };
  }, [datePreset, customRange, transactionsData]);

  const filteredByDateRange = useMemo(() => {
    return transactionsData.filter((tx) => tx.occurredAt >= startDate && tx.occurredAt <= endDate);
  }, [transactionsData, startDate, endDate]);

  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();

    filteredByDateRange.forEach((tx) => {
      monthSet.add(getMonthKey(tx.occurredAt));
    });

    return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  }, [filteredByDateRange]);

  const effectiveSelectedMonth = useMemo(() => {
    if (availableMonths.length === 0) return "";
    if (availableMonths.includes(selectedMonth)) return selectedMonth;
    return availableMonths[0];
  }, [availableMonths, selectedMonth]);

  useEffect(() => {
    if (!effectiveSelectedMonth) return;
    if (selectedMonth !== effectiveSelectedMonth) {
      setSelectedMonth(effectiveSelectedMonth);
    }
  }, [effectiveSelectedMonth, selectedMonth]);

  const filteredByMonth = useMemo(() => {
    if (!effectiveSelectedMonth) return filteredByDateRange;

    return filteredByDateRange.filter((tx) => getMonthKey(tx.occurredAt) === effectiveSelectedMonth);
  }, [filteredByDateRange, effectiveSelectedMonth]);

  const { totalIncome, totalExpenses, netCashflow, savingsRate } = useMemo(() => {
    const income = filteredByDateRange.reduce((sum, tx) => {
      if (tx.type !== "income") return sum;
      return sum + Math.abs(tx.amount);
    }, 0);

    const expenses = filteredByDateRange.reduce((sum, tx) => {
      if (tx.type !== "expense") return sum;
      return sum + Math.abs(tx.amount);
    }, 0);

    const net = income - expenses;
    const rate = income > 0 ? (net / income) * 100 : 0;

    return {
      totalIncome: Math.round(income),
      totalExpenses: Math.round(expenses),
      netCashflow: Math.round(net),
      savingsRate: rate,
    };
  }, [filteredByDateRange]);

  const monthlyData = useMemo(() => {
    const monthlyMap = new Map<string, { income: number; expenses: number }>();

    filteredByDateRange.forEach((tx) => {
      const key = getMonthKey(tx.occurredAt);
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { income: 0, expenses: 0 });
      }

      const bucket = monthlyMap.get(key)!;
      if (tx.type === "income") {
        bucket.income += Math.abs(tx.amount);
      } else {
        bucket.expenses += Math.abs(tx.amount);
      }
    });

    return Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month: formatMonthShort(month),
        income: Math.round(values.income),
        expenses: Math.round(values.expenses),
      }));
  }, [filteredByDateRange]);

  const categoryData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    let total = 0;

    filteredByMonth.forEach((tx) => {
      if (tx.type !== "expense") return;

      const amount = Math.abs(tx.amount);
      categoryMap.set(tx.category, (categoryMap.get(tx.category) || 0) + amount);
      total += amount;
    });

    return Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        color: getCategoryColor(name),
        percent: total > 0 ? Math.round((value / total) * 100) : 0,
      }));
  }, [filteredByMonth]);

  const topCategories = useMemo(() => {
    return categoryData.slice(0, 5).map((cat) => ({
      category: cat.name,
      amount: cat.value,
      percent: cat.percent,
    }));
  }, [categoryData]);

  const { stackedMonthlyData, stackedCategories } = useMemo(() => {
    const monthlyCategoryMap = new Map<string, Map<string, number>>();
    const categoryTotals = new Map<string, number>();

    filteredByDateRange.forEach((tx) => {
      if (tx.type !== "expense") return;

      const monthKey = getMonthKey(tx.occurredAt);
      if (!monthlyCategoryMap.has(monthKey)) {
        monthlyCategoryMap.set(monthKey, new Map());
      }

      const monthCategories = monthlyCategoryMap.get(monthKey)!;
      const amount = Math.abs(tx.amount);
      monthCategories.set(tx.category, (monthCategories.get(tx.category) || 0) + amount);
      categoryTotals.set(tx.category, (categoryTotals.get(tx.category) || 0) + amount);
    });

    const topCategoryNames = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);

    const usedKeys = new Set<string>();
    const categories: StackedCategory[] = topCategoryNames.map((name, index) => {
      let key = toChartKey(name) || `category_${index + 1}`;
      while (usedKeys.has(key)) {
        key = `${key}_${index + 1}`;
      }
      usedKeys.add(key);

      return {
        name,
        key,
        color: getCategoryColor(name),
      };
    });

    const data: StackedMonthData[] = Array.from(monthlyCategoryMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, categoryMap]) => {
        const row: StackedMonthData = {
          month: formatMonthShort(monthKey),
        };

        categories.forEach((category) => {
          row[category.key] = Math.round(categoryMap.get(category.name) || 0);
        });

        return row;
      });

    return {
      stackedMonthlyData: data,
      stackedCategories: categories,
    };
  }, [filteredByDateRange]);

  const topMerchants = useMemo(() => {
    const merchantMap = new Map<string, { amount: number; transactions: number }>();

    filteredByMonth.forEach((tx) => {
      if (tx.type !== "expense") return;

      const current = merchantMap.get(tx.merchant) || { amount: 0, transactions: 0 };
      merchantMap.set(tx.merchant, {
        amount: current.amount + Math.abs(tx.amount),
        transactions: current.transactions + 1,
      });
    });

    return Array.from(merchantMap.entries())
      .map(([merchant, data]) => ({ merchant, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((merchant) => ({
        ...merchant,
        amount: Math.round(merchant.amount),
      }));
  }, [filteredByMonth]);

  const handleCustomRangeApply = () => {
    if (!customRange.from || !customRange.to) {
      toast.error("Please select both start and end dates");
      return;
    }

    const from = parseDate(customRange.from);
    const to = parseDate(customRange.to);

    if (!from || !to) {
      toast.error("Invalid date range");
      return;
    }

    if (from > to) {
      toast.error("Start date must be before end date");
      return;
    }

    setDatePreset("custom");
    setCustomRangeOpen(false);
    toast.success("Custom date range applied");
  };

  const handleDatePresetChange = (value: string) => {
    if (value === "custom") {
      setCustomRangeOpen(true);
      return;
    }

    setDatePreset(value as DatePreset);
  };

  const handleExport = () => {
    try {
      const escapeCSV = (value: string | number | null | undefined): string => {
        if (value === null || value === undefined) return "";
        const str = String(value);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const lines: string[] = [];

      lines.push("FINANCIAL SUMMARY");
      lines.push(`Date Range,${getPresetLabel(datePreset)}`);
      lines.push(`From,${formatDate(startDate)}`);
      lines.push(`To,${formatDate(endDate)}`);
      lines.push(`Selected Month,${effectiveSelectedMonth ? formatMonthDisplay(effectiveSelectedMonth) : "N/A"}`);
      lines.push("");
      lines.push("Metric,Value");
      lines.push(`Total Income,${formatPKR(totalIncome)}`);
      lines.push(`Total Expenses,${formatPKR(totalExpenses)}`);
      lines.push(`Net Cashflow,${formatPKR(netCashflow)}`);
      lines.push(`Savings Rate,${savingsRate.toFixed(1)}%`);
      lines.push("");
      lines.push("TRANSACTIONS");
      lines.push("Date,Merchant,Category,Type,Amount");

      filteredByDateRange.forEach((tx) => {
        lines.push(
          [
            escapeCSV(formatDate(tx.occurredAt)),
            escapeCSV(tx.merchant),
            escapeCSV(tx.category),
            escapeCSV(tx.type),
            escapeCSV(formatPKR(Math.abs(tx.amount))),
          ].join(",")
        );
      });

      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      const fileScope = effectiveSelectedMonth || datePreset;
      link.setAttribute("href", url);
      link.setAttribute("download", `finflow-summary-${fileScope}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Summary exported successfully");
    } catch (exportError) {
      console.error("Export failed:", exportError);
      toast.error("Failed to export summary");
    }
  };

  if (loading) {
    return <div className="rounded-xl border bg-white p-6 text-sm text-zinc-500">Loading summary...</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <p className="text-sm text-red-600">{error}</p>
        <Button className="mt-3 rounded-xl" variant="outline" onClick={() => void fetchAllTransactions()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">Financial Summary</h1>
          <p className="text-foreground/60">Detailed breakdown of your income and spending</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={datePreset} onValueChange={handleDatePresetChange}>
            <SelectTrigger className="w-full sm:w-[180px] rounded-xl">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-50">
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="3m">Last 3 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={effectiveSelectedMonth || undefined}
            onValueChange={setSelectedMonth}
            disabled={availableMonths.length === 0}
          >
            <SelectTrigger className="w-full sm:w-[180px] rounded-xl">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent className="z-50">
              {availableMonths.map((month) => (
                <SelectItem key={month} value={month}>
                  {formatMonthDisplay(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" className="rounded-xl" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Dialog open={customRangeOpen} onOpenChange={setCustomRangeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Custom Date Range</DialogTitle>
            <DialogDescription>
              Select a custom start and end date to filter your financial data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="from-date">From</Label>
              <Input
                id="from-date"
                type="date"
                value={customRange.from}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, from: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to-date">To</Label>
              <Input
                id="to-date"
                type="date"
                value={customRange.to}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, to: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomRangeOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleCustomRangeApply} className="rounded-xl">
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="p-6 rounded-3xl border-2 bg-gradient-to-br from-[#dcfce7] to-white">
            <div className="flex items-start justify-between mb-4">
              <div className="text-sm text-foreground/60">Total Income</div>
              <div className="w-10 h-10 rounded-xl bg-[#86efac]/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#16a34a]" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-2">{formatPKR(totalIncome)}</div>
            <div className="flex items-center gap-1 text-sm text-[#16a34a]">
              <span>{getPresetLabel(datePreset)}</span>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-6 rounded-3xl border-2 bg-gradient-to-br from-[#f3e8ff] to-white">
            <div className="flex items-start justify-between mb-4">
              <div className="text-sm text-foreground/60">Total Expenses</div>
              <div className="w-10 h-10 rounded-xl bg-[#c084fc]/20 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-[#9333ea]" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-2">{formatPKR(totalExpenses)}</div>
            <div className="flex items-center gap-1 text-sm text-[#9333ea]">
              <span>{getPresetLabel(datePreset)}</span>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-6 rounded-3xl border-2 bg-gradient-to-br from-[#cffafe] to-white">
            <div className="flex items-start justify-between mb-4">
              <div className="text-sm text-foreground/60">Net Cashflow</div>
              <div className="w-10 h-10 rounded-xl bg-[#67e8f9]/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[#0891b2]" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-2">{formatPKR(netCashflow)}</div>
            <div className="flex items-center gap-1 text-sm text-[#16a34a]">
              <span>Income minus expenses</span>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="p-6 rounded-3xl border-2 bg-gradient-to-br from-[#dbeafe] to-white">
            <div className="flex items-start justify-between mb-4">
              <div className="text-sm text-foreground/60">Savings Rate</div>
              <div className="w-10 h-10 rounded-xl bg-[#93c5fd]/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#2563eb]" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-2">{savingsRate.toFixed(1)}%</div>
            <div className="flex items-center gap-1 text-sm text-foreground/60">
              <span>Of total income</span>
            </div>
          </Card>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-6 rounded-3xl border-2">
            <h3 className="text-lg font-semibold mb-6">Income vs Expenses</h3>
            <div style={{ width: "100%", height: "300px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "2px solid #e5e7eb",
                      borderRadius: "16px",
                      padding: "12px",
                    }}
                    formatter={(value) => formatPKR(Number(value || 0))}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="#86efac"
                    strokeWidth={3}
                    dot={{ fill: "#86efac", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="#c084fc"
                    strokeWidth={3}
                    dot={{ fill: "#c084fc", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="p-6 rounded-3xl border-2">
            <h3 className="text-lg font-semibold mb-6">Spending by Category</h3>
            {categoryData.length > 0 ? (
              <>
                <div style={{ width: "100%", height: "300px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "2px solid #e5e7eb",
                          borderRadius: "16px",
                          padding: "12px",
                        }}
                        formatter={(value) => formatPKR(Number(value || 0))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {categoryData.map((cat, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm text-foreground/70 truncate">{cat.name}</span>
                      <span className="text-sm font-medium ml-auto">{cat.percent}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-foreground/60">
                No expense data for selected period
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="p-6 rounded-3xl border-2">
          <h3 className="text-lg font-semibold mb-6">Monthly Spending Breakdown</h3>
          {stackedMonthlyData.length > 0 && stackedCategories.length > 0 ? (
            <div style={{ width: "100%", height: "350px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stackedMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "2px solid #e5e7eb",
                      borderRadius: "16px",
                      padding: "12px",
                    }}
                    formatter={(value) => formatPKR(Number(value || 0))}
                  />
                  <Legend />
                  {stackedCategories.map((category, index) => (
                    <Bar
                      key={category.key}
                      dataKey={category.key}
                      name={category.name}
                      stackId="a"
                      fill={category.color}
                      radius={
                        index === stackedCategories.length - 1
                          ? [8, 8, 0, 0]
                          : [0, 0, 0, 0]
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-foreground/60">
              No spending data for this range
            </div>
          )}
        </Card>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <Card className="p-6 rounded-3xl border-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Top Categories</h3>
              <Link to="/dashboard/transactions">
                <Button variant="ghost" size="sm" className="text-primary">
                  View all
                </Button>
              </Link>
            </div>
            <div className="space-y-4">
              {topCategories.length > 0 ? (
                topCategories.map((cat, i) => (
                  <Link key={i} to={`/dashboard/transactions?category=${encodeURIComponent(cat.category)}`} className="block">
                    <div className="flex items-center gap-4 p-3 rounded-2xl hover:bg-accent transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="font-medium mb-1">{cat.category}</div>
                        <div className="text-sm text-foreground/60">{cat.percent}% of total</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatPKR(cat.amount)}</div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center text-foreground/60 py-8">
                  No categories found for selected period
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <Card className="p-6 rounded-3xl border-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Top Merchants</h3>
              <Link to="/dashboard/transactions">
                <Button variant="ghost" size="sm" className="text-primary">
                  View all
                </Button>
              </Link>
            </div>
            <div className="space-y-4">
              {topMerchants.length > 0 ? (
                topMerchants.map((merchant, i) => (
                  <Link
                    key={i}
                    to={`/dashboard/transactions?merchant=${encodeURIComponent(merchant.merchant)}`}
                    className="block"
                  >
                    <div className="flex items-center gap-4 p-3 rounded-2xl hover:bg-accent transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="font-medium mb-1">{merchant.merchant}</div>
                        <div className="text-sm text-foreground/60">{merchant.transactions} transactions</div>
                      </div>
                      <div className="font-semibold">{formatPKR(merchant.amount)}</div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center text-foreground/60 py-8">
                  No merchants found for selected period
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <Card className="p-6 rounded-3xl border-2 bg-gradient-to-br from-accent to-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold mb-1">Need to adjust your budget?</h3>
              <p className="text-sm text-foreground/60">
                Based on your selected period, you may want to update your budget categories.
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/dashboard/budget">
                <Button className="rounded-xl">Adjust Budget</Button>
              </Link>
              <Button variant="outline" className="rounded-xl">
                <Share2 className="w-4 h-4 mr-2" />
                Share Report
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
