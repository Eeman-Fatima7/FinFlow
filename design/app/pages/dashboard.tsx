import { Card } from "../components/ui/card";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  Target,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { motion } from "motion/react";
import { useState, useMemo } from "react";
import { Link } from "react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { usePreferences, formatMoney } from "../lib/preferences";

const donutData = [
  { name: "Income", value: 8400, color: "#86efac" },
  { name: "Bills", value: 1200, color: "#c084fc" },
  { name: "Planned Spend", value: 1245, color: "#67e8f9" },
  { name: "Other Spend", value: 800, color: "#f9a8d4" },
];

const trendData = [
  { month: "Jan", amount: 5200 },
  { month: "Feb", amount: 5800 },
  { month: "Mar", amount: 5100 },
  { month: "Apr", amount: 6200 },
  { month: "May", amount: 5900 },
  { month: "Jun", amount: 5155 },
];

const categories = [
  { name: "Income", amount: 8400, budget: 8400, color: "#86efac", lightColor: "#dcfce7", icon: DollarSign },
  { name: "Bills", amount: 1200, budget: 1500, color: "#c084fc", lightColor: "#f3e8ff", icon: CreditCard },
  { name: "Planned Spend", amount: 1245, budget: 2000, color: "#67e8f9", lightColor: "#cffafe", icon: Target },
  { name: "Other Spend", amount: 800, budget: 1000, color: "#f9a8d4", lightColor: "#fce7f3", icon: TrendingDown },
];

const recentTransactions = [
  { id: 1, name: "Whole Foods", amount: -87.32, category: "Groceries", date: "Today", color: "#67e8f9" },
  { id: 2, name: "Spotify", amount: -15.99, category: "Subscriptions", date: "Today", color: "#c084fc" },
  { id: 3, name: "Salary Deposit", amount: 4200, category: "Income", date: "Yesterday", color: "#86efac" },
  { id: 4, name: "Electric Bill", amount: -142.50, category: "Bills", date: "2 days ago", color: "#c084fc" },
  { id: 5, name: "Amazon", amount: -45.20, category: "Shopping", date: "3 days ago", color: "#f9a8d4" },
];

// Mock historical transaction data for trend calculation
const mockHistoricalExpenses = [
  // Past 12 months of sample expense data
  { date: new Date(2025, 7, 15), amount: 3200 }, // Aug 2025
  { date: new Date(2025, 8, 10), amount: 3450 }, // Sep 2025
  { date: new Date(2025, 9, 5), amount: 3100 }, // Oct 2025
  { date: new Date(2025, 10, 12), amount: 3300 }, // Nov 2025
  { date: new Date(2025, 11, 8), amount: 3600 }, // Dec 2025
  { date: new Date(2026, 0, 15), amount: 3200 }, // Jan 2026
  { date: new Date(2026, 1, 10), amount: 3400 }, // Feb 2026
  { date: new Date(2026, 1, 3), amount: 2400 }, // Feb 2026 (week 1)
  { date: new Date(2026, 1, 9), amount: 2700 }, // Feb 2026 (week 2)
  { date: new Date(2026, 1, 16), amount: 2900 }, // Feb 2026 (week 3)
  { date: new Date(2026, 1, 23), amount: 3100 }, // Feb 2026 (week 4)
];

type SpendingRange = "1m" | "2m" | "3m" | "6m" | "12m" | "all";

// Helper to generate trend data based on range
function generateTrendData(range: SpendingRange) {
  const today = new Date(2026, 1, 15); // Feb 15, 2026
  
  // For demo purposes, generate realistic spending data
  if (range === "1m") {
    // Last 1 month - show weekly data (4 weeks)
    return [
      { month: "Week 1", amount: 720 },
      { month: "Week 2", amount: 850 },
      { month: "Week 3", amount: 790 },
      { month: "Week 4", amount: 885 },
    ];
  } else if (range === "2m") {
    // Last 2 months - show weekly data (8 weeks)
    return [
      { month: "Jan W1", amount: 680 },
      { month: "Jan W2", amount: 750 },
      { month: "Jan W3", amount: 820 },
      { month: "Jan W4", amount: 790 },
      { month: "Feb W1", amount: 720 },
      { month: "Feb W2", amount: 850 },
      { month: "Feb W3", amount: 790 },
      { month: "Feb W4", amount: 885 },
    ];
  } else if (range === "3m") {
    // Last 3 months - show monthly data
    return [
      { month: "Dec", amount: 3600 },
      { month: "Jan", amount: 3200 },
      { month: "Feb", amount: 3245 },
    ];
  } else if (range === "6m") {
    // Last 6 months - show monthly data
    return [
      { month: "Sep", amount: 3450 },
      { month: "Oct", amount: 3100 },
      { month: "Nov", amount: 3300 },
      { month: "Dec", amount: 3600 },
      { month: "Jan", amount: 3200 },
      { month: "Feb", amount: 3245 },
    ];
  } else if (range === "12m") {
    // Last 12 months - show monthly data
    return [
      { month: "Mar '25", amount: 3350 },
      { month: "Apr", amount: 3150 },
      { month: "May", amount: 3400 },
      { month: "Jun", amount: 3250 },
      { month: "Jul", amount: 3500 },
      { month: "Aug", amount: 3200 },
      { month: "Sep", amount: 3450 },
      { month: "Oct", amount: 3100 },
      { month: "Nov", amount: 3300 },
      { month: "Dec", amount: 3600 },
      { month: "Jan '26", amount: 3200 },
      { month: "Feb", amount: 3245 },
    ];
  } else {
    // All time - show last 12 months as sample
    return [
      { month: "Mar '25", amount: 3350 },
      { month: "Apr", amount: 3150 },
      { month: "May", amount: 3400 },
      { month: "Jun", amount: 3250 },
      { month: "Jul", amount: 3500 },
      { month: "Aug", amount: 3200 },
      { month: "Sep", amount: 3450 },
      { month: "Oct", amount: 3100 },
      { month: "Nov", amount: 3300 },
      { month: "Dec", amount: 3600 },
      { month: "Jan '26", amount: 3200 },
      { month: "Feb", amount: 3245 },
    ];
  }
}

function getRangeLabel(range: SpendingRange): string {
  const labels: Record<SpendingRange, string> = {
    "1m": "Last 1 month",
    "2m": "Last 2 months",
    "3m": "Last 3 months",
    "6m": "Last 6 months",
    "12m": "Last 12 months",
    "all": "All time",
  };
  return labels[range];
}

export function Dashboard() {
  const { preferences } = usePreferences();
  const totalSpent = donutData.slice(1).reduce((sum, item) => sum + item.value, 0);
  const leftThisMonth = donutData[0].value - totalSpent;
  const dailyBudget = leftThisMonth / 15; // Assuming 15 days left

  const [spendingRange, setSpendingRange] = useState<SpendingRange>("6m");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Generate trend data based on selected range
  const trendData = useMemo(() => generateTrendData(spendingRange), [spendingRange]);

  const filteredCategories = useMemo(() => {
    if (selectedCategory === "All") {
      return categories;
    }
    return categories.filter(category => category.name === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="space-y-6 max-w-[1320px] mx-auto">
      {/* Top stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">Total Balance</span>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">$24,847.50</div>
            <div className="flex items-center gap-1 text-sm text-[#16a34a]">
              <TrendingUp className="w-4 h-4" />
              <span>+12.5% vs last month</span>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">This Month Income</span>
              <div className="w-10 h-10 rounded-xl bg-[#dcfce7] flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-[#16a34a]" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">$8,400</div>
            <div className="text-sm text-foreground/60">+$400 from last month</div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">Total Expenses</span>
              <div className="w-10 h-10 rounded-xl bg-[#f3e8ff] flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5 text-[#9333ea]" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">$3,245</div>
            <div className="text-sm text-foreground/60">39% of income</div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">Savings Goal</span>
              <div className="w-10 h-10 rounded-xl bg-[#dbeafe] flex items-center justify-center">
                <Target className="w-5 h-5 text-[#2563eb]" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">$5,155</div>
            <div className="flex items-center justify-between text-sm mt-3">
              <span className="text-foreground/60">$8,000 goal</span>
              <span className="font-medium text-[#2563eb]">64%</span>
            </div>
            <div className="w-full bg-accent rounded-full h-2 mt-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#93c5fd] to-[#2563eb] rounded-full" style={{ width: '64%' }} />
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left this month - Donut chart */}
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
                transition={{ 
                  type: "spring", 
                  damping: 20, 
                  stiffness: 300,
                  delay: 0.3 
                }}
              >
                <motion.div 
                  className="text-3xl font-bold"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                >
                  ${leftThisMonth.toLocaleString()}
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
                <div className="text-2xl font-bold">${dailyBudget.toFixed(2)}</div>
                <div className="text-xs text-foreground/60 mt-1">15 days remaining</div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Spending trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2"
        >
          <Card className="p-6 rounded-3xl border-2 h-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Spending Trend</h3>
              <Select
                value={spendingRange}
                onValueChange={(value) => setSpendingRange(value as SpendingRange)}
              >
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
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: '#71717a', fontSize: 12 }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '8px 12px'
                    }}
                    formatter={(value) => [`$${value}`, 'Expenses']}
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
          </Card>
        </motion.div>
      </div>

      {/* Categories overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Category Breakdown</h3>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select a category">
                  {selectedCategory}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.name} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredCategories.map((category, index) => {
              const percentage = (category.amount / category.budget) * 100;
              const Icon = category.icon;
              
              return (
                <motion.div
                  key={category.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                >
                  <Card 
                    className="p-5 rounded-2xl border hover:shadow-md transition-shadow"
                    style={{ backgroundColor: category.lightColor }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: category.color }}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs font-medium" style={{ color: category.color }}>
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-sm text-foreground/70 mb-1">{category.name}</div>
                    <div className="text-2xl font-bold mb-2">
                      ${category.amount.toLocaleString()}
                    </div>
                    <div className="text-xs text-foreground/60">
                      of ${category.budget.toLocaleString()} budget
                    </div>
                    <div className="w-full bg-white rounded-full h-1.5 mt-3 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${Math.min(percentage, 100)}%`,
                          backgroundColor: category.color
                        }} 
                      />
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {/* Recent transactions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
            <Link to="/app/transactions" className="text-sm text-primary hover:underline">View all</Link>
          </div>

          <div className="space-y-3">
            {recentTransactions.map((transaction, index) => (
              <motion.div
                key={transaction.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + index * 0.05 }}
                className="flex items-center justify-between p-4 rounded-2xl hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-sm"
                    style={{ backgroundColor: transaction.color }}
                  >
                    {transaction.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium">{transaction.name}</div>
                    <div className="text-sm text-foreground/60">{transaction.category} • {transaction.date}</div>
                  </div>
                </div>
                <div className={`text-lg font-semibold ${transaction.amount > 0 ? 'text-[#16a34a]' : 'text-foreground'}`}>
                  {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}