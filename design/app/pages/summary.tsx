import { motion } from "motion/react";
import { Link } from "react-router";
import { 
  TrendingUp, 
  TrendingDown, 
  Download, 
  Share2, 
  Calendar,
  ChevronDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useState, useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
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
  ResponsiveContainer
} from "recharts";

// Transaction type matching the main app
type Transaction = {
  id: number;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  status: string;
  color: string;
  paymentMethod?: string;
  notes?: string;
};

// Mock transactions data (would come from a global store in production)
const mockTransactions: Transaction[] = [
  // January 2026
  { id: 1, date: "2026-01-15", merchant: "Landlord/Rent", category: "Housing", amount: -1800, status: "completed", color: "#86efac" },
  { id: 2, date: "2026-01-05", merchant: "Acme Corp", category: "Income", amount: 8400, status: "completed", color: "#86efac" },
  { id: 3, date: "2026-01-10", merchant: "Whole Foods", category: "Groceries", amount: -340, status: "completed", color: "#c084fc" },
  { id: 4, date: "2026-01-12", merchant: "Shell Gas", category: "Transportation", amount: -65, status: "completed", color: "#67e8f9" },
  { id: 5, date: "2026-01-20", merchant: "Netflix", category: "Entertainment", amount: -18, status: "completed", color: "#f9a8d4" },
  { id: 6, date: "2026-01-25", merchant: "Amazon", category: "Shopping", amount: -120, status: "completed", color: "#93c5fd" },
  
  // February 2026
  { id: 7, date: "2026-02-01", merchant: "Acme Corp", category: "Income", amount: 8400, status: "completed", color: "#86efac" },
  { id: 8, date: "2026-02-15", merchant: "Landlord/Rent", category: "Housing", amount: -1800, status: "completed", color: "#86efac" },
  { id: 9, date: "2026-02-08", merchant: "Whole Foods", category: "Groceries", amount: -310, status: "completed", color: "#c084fc" },
  { id: 10, date: "2026-02-14", merchant: "Starbucks", category: "Food & Drink", amount: -45, status: "completed", color: "#c084fc" },
  { id: 11, date: "2026-02-20", merchant: "Shell Gas", category: "Transportation", amount: -70, status: "completed", color: "#67e8f9" },
  
  // March 2026
  { id: 12, date: "2026-03-01", merchant: "Acme Corp", category: "Income", amount: 9200, status: "completed", color: "#86efac" },
  { id: 13, date: "2026-03-15", merchant: "Landlord/Rent", category: "Housing", amount: -1800, status: "completed", color: "#86efac" },
  { id: 14, date: "2026-03-10", merchant: "Whole Foods", category: "Groceries", amount: -380, status: "completed", color: "#c084fc" },
  { id: 15, date: "2026-03-18", merchant: "Movies", category: "Entertainment", amount: -45, status: "completed", color: "#f9a8d4" },
  { id: 16, date: "2026-03-25", merchant: "Target", category: "Shopping", amount: -180, status: "completed", color: "#93c5fd" },
  
  // April 2026
  { id: 17, date: "2026-04-01", merchant: "Acme Corp", category: "Income", amount: 8400, status: "completed", color: "#86efac" },
  { id: 18, date: "2026-04-15", merchant: "Landlord/Rent", category: "Housing", amount: -1800, status: "completed", color: "#86efac" },
  { id: 19, date: "2026-04-12", merchant: "Whole Foods", category: "Groceries", amount: -290, status: "completed", color: "#c084fc" },
  { id: 20, date: "2026-04-22", merchant: "Shell Gas", category: "Transportation", amount: -60, status: "completed", color: "#67e8f9" },
  
  // May 2026
  { id: 21, date: "2026-05-01", merchant: "Acme Corp", category: "Income", amount: 8400, status: "completed", color: "#86efac" },
  { id: 22, date: "2026-05-15", merchant: "Landlord/Rent", category: "Housing", amount: -1800, status: "completed", color: "#86efac" },
  { id: 23, date: "2026-05-08", merchant: "Whole Foods", category: "Groceries", amount: -320, status: "completed", color: "#c084fc" },
  { id: 24, date: "2026-05-20", merchant: "Netflix", category: "Entertainment", amount: -18, status: "completed", color: "#f9a8d4" },
  { id: 25, date: "2026-05-28", merchant: "Amazon", category: "Shopping", amount: -95, status: "completed", color: "#93c5fd" },
  
  // June 2026 (most recent month)
  { id: 26, date: "2026-06-01", merchant: "Acme Corp", category: "Income", amount: 10200, status: "completed", color: "#86efac" },
  { id: 27, date: "2026-06-15", merchant: "Landlord/Rent", category: "Housing", amount: -1800, status: "completed", color: "#86efac" },
  { id: 28, date: "2026-06-05", merchant: "Whole Foods", category: "Groceries", amount: -380, status: "completed", color: "#c084fc" },
  { id: 29, date: "2026-06-10", merchant: "Restaurant", category: "Food & Drink", amount: -85, status: "completed", color: "#c084fc" },
  { id: 30, date: "2026-06-12", merchant: "Shell Gas", category: "Transportation", amount: -75, status: "completed", color: "#67e8f9" },
  { id: 31, date: "2026-06-18", merchant: "Spotify", category: "Entertainment", amount: -15, status: "completed", color: "#f9a8d4" },
  { id: 32, date: "2026-06-20", merchant: "Target", category: "Shopping", amount: -220, status: "completed", color: "#93c5fd" },
  { id: 33, date: "2026-06-25", merchant: "Gym", category: "Health", amount: -50, status: "completed", color: "#fda4af" },
];

export function Summary() {
  // State for date filtering
  const [datePreset, setDatePreset] = useState<"7d" | "30d" | "3m" | "1y" | "all" | "custom">("30d");
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-06");

  // Calculate date range based on preset
  const { startDate, endDate } = useMemo(() => {
    const today = new Date("2026-06-16"); // Fixed "today" for demo consistency
    let start: Date;
    let end: Date = today;

    if (datePreset === "custom" && customRange.from && customRange.to) {
      start = new Date(customRange.from);
      end = new Date(customRange.to);
    } else if (datePreset === "7d") {
      start = new Date(today);
      start.setDate(start.getDate() - 7);
    } else if (datePreset === "30d") {
      start = new Date(today);
      start.setDate(start.getDate() - 30);
    } else if (datePreset === "3m") {
      start = new Date(today);
      start.setMonth(start.getMonth() - 3);
    } else if (datePreset === "1y") {
      start = new Date(today);
      start.setFullYear(start.getFullYear() - 1);
    } else {
      // "all" - get earliest transaction date
      const dates = mockTransactions.map(t => new Date(t.date));
      start = new Date(Math.min(...dates.map(d => d.getTime())));
    }

    return { startDate: start, endDate: end };
  }, [datePreset, customRange]);

  // Filter transactions by date range
  const filteredByDateRange = useMemo(() => {
    return mockTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= startDate && txDate <= endDate;
    });
  }, [startDate, endDate]);

  // Get available months from filtered transactions
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    filteredByDateRange.forEach(tx => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthSet.add(monthKey);
    });
    return Array.from(monthSet).sort().reverse();
  }, [filteredByDateRange]);

  // Set default month if current selection is not available
  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Filter transactions by selected month (for month-specific views)
  const filteredByMonth = useMemo(() => {
    if (!selectedMonth) return filteredByDateRange;
    return filteredByDateRange.filter(tx => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return monthKey === selectedMonth;
    });
  }, [filteredByDateRange, selectedMonth]);

  // Calculate metrics from filtered transactions
  const { totalIncome, totalExpenses, netCashflow, savingsRate } = useMemo(() => {
    const income = filteredByDateRange.reduce((acc, tx) => tx.amount > 0 ? acc + tx.amount : acc, 0);
    const expenses = filteredByDateRange.reduce((acc, tx) => tx.amount < 0 ? acc + Math.abs(tx.amount) : acc, 0);
    const net = income - expenses;
    const rate = income > 0 ? (net / income) * 100 : 0;
    
    return {
      totalIncome: income,
      totalExpenses: expenses,
      netCashflow: net,
      savingsRate: rate,
    };
  }, [filteredByDateRange]);

  // Calculate monthly data for Income vs Expenses chart (based on date range)
  const monthlyData = useMemo(() => {
    const monthlyMap = new Map<string, { income: number; expenses: number }>();
    
    filteredByDateRange.forEach(tx => {
      const date = new Date(tx.date);
      const monthKey = date.toLocaleDateString("en-US", { month: "short" });
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { income: 0, expenses: 0 });
      }
      
      const data = monthlyMap.get(monthKey)!;
      if (tx.amount > 0) {
        data.income += tx.amount;
      } else {
        data.expenses += Math.abs(tx.amount);
      }
    });
    
    return Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      income: data.income,
      expenses: data.expenses,
    }));
  }, [filteredByDateRange]);

  // Calculate category data for donut chart (based on month filter)
  const categoryData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    let total = 0;
    
    filteredByMonth.forEach(tx => {
      if (tx.amount < 0) { // Only expenses
        const amount = Math.abs(tx.amount);
        categoryMap.set(tx.category, (categoryMap.get(tx.category) || 0) + amount);
        total += amount;
      }
    });
    
    // Color mapping for categories
    const colorMap: Record<string, string> = {
      Housing: "#86efac",
      Groceries: "#c084fc",
      "Food & Drink": "#f9a8d4",
      Transportation: "#67e8f9",
      Entertainment: "#fda4af",
      Shopping: "#93c5fd",
      Health: "#fda4af",
      Subscriptions: "#a78bfa",
    };
    
    return Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value,
      color: colorMap[name] || "#d1d5db",
      percent: total > 0 ? Math.round((value / total) * 100) : 0,
    }));
  }, [filteredByMonth]);

  // Calculate top categories
  const topCategories = useMemo(() => {
    return categoryData
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map(cat => ({
        category: cat.name,
        amount: cat.value,
        percent: cat.percent,
        change: 0, // Would calculate from previous period in real app
      }));
  }, [categoryData]);

  // Calculate stacked monthly breakdown data (based on date range, NOT single month)
  const stackedMonthlyData = useMemo(() => {
    // First, collect all categories from the filtered range
    const allCategories = new Set<string>();
    filteredByDateRange.forEach(tx => {
      if (tx.amount < 0) {
        allCategories.add(tx.category);
      }
    });

    // Group by month and category
    const monthlyMap = new Map<string, Map<string, number>>();
    
    filteredByDateRange.forEach(tx => {
      if (tx.amount < 0) { // Only expenses
        const date = new Date(tx.date);
        const monthKey = date.toLocaleDateString("en-US", { month: "short" });
        
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, new Map());
        }
        
        const categoryMap = monthlyMap.get(monthKey)!;
        const amount = Math.abs(tx.amount);
        categoryMap.set(tx.category, (categoryMap.get(tx.category) || 0) + amount);
      }
    });
    
    // Convert to array format for Recharts
    return Array.from(monthlyMap.entries()).map(([month, categoryMap]) => {
      const monthData: any = { month };
      categoryMap.forEach((amount, category) => {
        // Use lowercase keys for chart data
        const key = category.toLowerCase().replace(/\s+/g, '');
        monthData[key] = Math.round(amount);
      });
      return monthData;
    });
  }, [filteredByDateRange]);

  // Calculate top merchants
  const topMerchants = useMemo(() => {
    const merchantMap = new Map<string, { amount: number; transactions: number }>();
    
    filteredByMonth.forEach(tx => {
      if (tx.amount < 0) {
        const current = merchantMap.get(tx.merchant) || { amount: 0, transactions: 0 };
        merchantMap.set(tx.merchant, {
          amount: current.amount + Math.abs(tx.amount),
          transactions: current.transactions + 1,
        });
      }
    });
    
    return Array.from(merchantMap.entries())
      .map(([merchant, data]) => ({ merchant, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredByMonth]);

  // Handle custom date range
  const handleCustomRangeApply = () => {
    if (!customRange.from || !customRange.to) {
      toast.error("Please select both start and end dates");
      return;
    }
    
    const from = new Date(customRange.from);
    const to = new Date(customRange.to);
    
    if (from > to) {
      toast.error("Start date must be before end date");
      return;
    }
    
    setDatePreset("custom");
    setCustomRangeOpen(false);
    toast.success("Custom date range applied");
  };

  // Handle date preset change
  const handleDatePresetChange = (value: string) => {
    if (value === "custom") {
      setCustomRangeOpen(true);
    } else {
      setDatePreset(value as typeof datePreset);
    }
  };

  // Export to CSV
  const handleExport = () => {
    try {
      // Helper to escape CSV values
      const escapeCSV = (value: any): string => {
        if (value === null || value === undefined) return "";
        const str = String(value);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // Build CSV content
      const lines: string[] = [];
      
      // Summary metrics section
      lines.push("FINANCIAL SUMMARY");
      lines.push(`Date Range,${datePreset === "custom" ? `${customRange.from} to ${customRange.to}` : datePreset}`);
      lines.push(`Selected Month,${selectedMonth}`);
      lines.push("");
      lines.push("Metric,Value");
      lines.push(`Total Income,$${totalIncome.toFixed(2)}`);
      lines.push(`Total Expenses,$${totalExpenses.toFixed(2)}`);
      lines.push(`Net Cashflow,$${netCashflow.toFixed(2)}`);
      lines.push(`Savings Rate,${savingsRate.toFixed(2)}%`);
      lines.push("");
      
      // Transactions section
      lines.push("TRANSACTIONS");
      lines.push("Date,Merchant,Category,Amount,Status");
      filteredByDateRange.forEach(tx => {
        lines.push([
          escapeCSV(tx.date),
          escapeCSV(tx.merchant),
          escapeCSV(tx.category),
          `$${tx.amount.toFixed(2)}`,
          escapeCSV(tx.status),
        ].join(","));
      });
      
      // Create and download file
      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      const filename = datePreset === "custom"
        ? `finflow-summary-${customRange.from}_to_${customRange.to}.csv`
        : `finflow-summary-${selectedMonth || datePreset}.csv`;
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("Summary exported successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export summary");
    }
  };

  // Format month for display
  const formatMonthDisplay = (monthKey: string) => {
    const [year, month] = monthKey.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  return (
    <div className="space-y-8">
      {/* Page header with controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">Financial Summary</h1>
          <p className="text-foreground/60">Detailed breakdown of your income and spending</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Date range selector */}
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

          {/* Month picker */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-[180px] rounded-xl">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent className="z-50">
              {availableMonths.map(month => (
                <SelectItem key={month} value={month}>
                  {formatMonthDisplay(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Export button */}
          <Button variant="outline" className="rounded-xl" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Custom Date Range Dialog */}
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
                onChange={(e) => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to-date">To</Label>
              <Input
                id="to-date"
                type="date"
                value={customRange.to}
                onChange={(e) => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
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

      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="p-6 rounded-3xl border-2 bg-gradient-to-br from-[#dcfce7] to-white">
            <div className="flex items-start justify-between mb-4">
              <div className="text-sm text-foreground/60">Total Income</div>
              <div className="w-10 h-10 rounded-xl bg-[#86efac]/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#16a34a]" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div className="flex items-center gap-1 text-sm text-[#16a34a]">
              <span>Period: {datePreset}</span>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 rounded-3xl border-2 bg-gradient-to-br from-[#f3e8ff] to-white">
            <div className="flex items-start justify-between mb-4">
              <div className="text-sm text-foreground/60">Total Expenses</div>
              <div className="w-10 h-10 rounded-xl bg-[#c084fc]/20 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-[#9333ea]" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div className="flex items-center gap-1 text-sm text-[#9333ea]">
              <span>Period: {datePreset}</span>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6 rounded-3xl border-2 bg-gradient-to-br from-[#cffafe] to-white">
            <div className="flex items-start justify-between mb-4">
              <div className="text-sm text-foreground/60">Net Cashflow</div>
              <div className="w-10 h-10 rounded-xl bg-[#67e8f9]/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[#0891b2]" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">${netCashflow.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div className="flex items-center gap-1 text-sm text-[#16a34a]">
              <span>Income - Expenses</span>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6 rounded-3xl border-2 bg-gradient-to-br from-[#dbeafe] to-white">
            <div className="flex items-start justify-between mb-4">
              <div className="text-sm text-foreground/60">Savings Rate</div>
              <div className="w-10 h-10 rounded-xl bg-[#93c5fd]/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#2563eb]" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">{savingsRate.toFixed(1)}%</div>
            <div className="flex items-center gap-1 text-sm text-foreground/60">
              <span>Of total income</span>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Income vs Expenses Line Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6 rounded-3xl border-2">
            <h3 className="text-lg font-semibold mb-6">Income vs Expenses</h3>
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '2px solid #e5e7eb', 
                      borderRadius: '16px',
                      padding: '12px'
                    }} 
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="income" 
                    stroke="#86efac" 
                    strokeWidth={3}
                    dot={{ fill: '#86efac', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="expenses" 
                    stroke="#c084fc" 
                    strokeWidth={3}
                    dot={{ fill: '#c084fc', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        {/* Category Breakdown Donut Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6 rounded-3xl border-2">
            <h3 className="text-lg font-semibold mb-6">Spending by Category</h3>
            {categoryData.length > 0 ? (
              <>
                <div style={{ width: '100%', height: '300px' }}>
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
                          backgroundColor: 'white', 
                          border: '2px solid #e5e7eb', 
                          borderRadius: '16px',
                          padding: '12px'
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {categoryData.map((cat, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm text-foreground/70">{cat.name}</span>
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

      {/* Monthly Spending Breakdown Stacked Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <h3 className="text-lg font-semibold mb-6">Monthly Spending Breakdown</h3>
          {stackedMonthlyData.length > 0 ? (
            <div style={{ width: '100%', height: '350px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stackedMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '2px solid #e5e7eb', 
                      borderRadius: '16px',
                      padding: '12px'
                    }} 
                  />
                  <Legend />
                  <Bar dataKey="housing" stackId="a" fill="#86efac" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="groceries" stackId="a" fill="#c084fc" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="food&drink" stackId="a" fill="#f9a8d4" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="transportation" stackId="a" fill="#67e8f9" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="entertainment" stackId="a" fill="#fda4af" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="shopping" stackId="a" fill="#93c5fd" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="health" stackId="a" fill="#fda4af" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="subscriptions" stackId="a" fill="#a78bfa" radius={[8, 8, 0, 0]} />
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

      {/* Breakdown Tables */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Top Categories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Card className="p-6 rounded-3xl border-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Top Categories</h3>
              <Link to="/app/transactions">
                <Button variant="ghost" size="sm" className="text-primary">
                  View all
                </Button>
              </Link>
            </div>
            <div className="space-y-4">
              {topCategories.length > 0 ? (
                topCategories.map((cat, i) => (
                  <Link 
                    key={i} 
                    to={`/app/transactions?category=${cat.category}`}
                    className="block"
                  >
                    <div className="flex items-center gap-4 p-3 rounded-2xl hover:bg-accent transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="font-medium mb-1">{cat.category}</div>
                        <div className="text-sm text-foreground/60">{cat.percent}% of total</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${cat.amount.toLocaleString()}</div>
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

        {/* Top Merchants */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Card className="p-6 rounded-3xl border-2">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Top Merchants</h3>
              <Link to="/app/transactions">
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
                    to={`/app/transactions?merchant=${merchant.merchant}`}
                    className="block"
                  >
                    <div className="flex items-center gap-4 p-3 rounded-2xl hover:bg-accent transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="font-medium mb-1">{merchant.merchant}</div>
                        <div className="text-sm text-foreground/60">{merchant.transactions} transactions</div>
                      </div>
                      <div className="font-semibold">${merchant.amount.toLocaleString()}</div>
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

      {/* Actions row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <Card className="p-6 rounded-3xl border-2 bg-gradient-to-br from-accent to-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold mb-1">Need to adjust your budget?</h3>
              <p className="text-sm text-foreground/60">Based on this month's spending, you may want to update your budget categories</p>
            </div>
            <div className="flex gap-3">
              <Link to="/app/budget">
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