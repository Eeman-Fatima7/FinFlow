"use client";

import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Home,
  Car,
  ShoppingCart,
  Utensils,
  Tv,
  Heart,
  Tag,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AddBudgetCategoryModal } from "@/components/add-budget-category-modal";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api";
import { getCategoryColor } from "@/lib/categories";
import { formatMoney } from "@/lib/preferences";

const categoryIcons: Record<string, LucideIcon> = {
  Housing: Home,
  Transportation: Car,
  Groceries: ShoppingCart,
  Shopping: ShoppingCart,
  "Dining Out": Utensils,
  "Food & Drink": Utensils,
  Subscriptions: Tv,
  Healthcare: Heart,
  Health: Heart,
  "Bills & Utilities": CreditCard,
  Bills: CreditCard,
  Entertainment: Tv,
  Travel: Car,
  Education: Tag,
  "Personal Care": Heart,
  Gifts: Tag,
  Insurance: CreditCard,
  Savings: DollarSign,
  Other: Tag,
  Income: DollarSign,
};

const getCategoryIcon = (categoryName: string) => categoryIcons[categoryName] || Tag;

const fixedCategories = new Set([
  "Housing",
  "Bills",
  "Bills & Utilities",
  "Insurance",
  "Subscriptions",
]);

type BudgetCategory = {
  id: number;
  categoryId: number;
  name: string;
  icon: LucideIcon;
  color: string;
  lightColor: string;
  budget: number;
  spent: number;
  type: "fixed" | "flexible";
  alertThreshold?: number;
  notes?: string;
};

type ApiBudget = {
  budget_id: number;
  category_id: number;
  category_name: string;
  category_color: string | null;
  monthly_limit: string | number;
  spent: string | number;
};

type BudgetsResponse = {
  budgets: ApiBudget[];
};

type ApiCategory = {
  category_id: number;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
};

type CategoriesResponse = {
  categories: ApiCategory[];
};

type SummaryResponse = {
  income: number;
};

const toNumber = (value: string | number | null | undefined) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toLightColor = (color: string) => {
  if (color.startsWith("#") && color.length === 7) {
    return `${color}33`;
  }
  return "#f3f4f6";
};

const formatPKR = (value: number) => formatMoney(Math.round(value || 0), "PKR", "en");

export function BudgetPlanner() {
  const currentDate = new Date();
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const [budgets, setBudgets] = useState<BudgetCategory[]>([]);
  const [availableCategories, setAvailableCategories] = useState<ApiCategory[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirtyBudgetIds, setDirtyBudgetIds] = useState<Set<number>>(new Set());

  const fetchBudgetData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [budgetsResponse, categoriesResponse, summaryResponse] = await Promise.all([
        apiRequest<BudgetsResponse>("/budgets", {
          method: "GET",
          auth: true,
          query: { month, year },
        }),
        apiRequest<CategoriesResponse>("/categories", {
          method: "GET",
          auth: true,
        }).catch(() => ({ categories: [] })),
        apiRequest<SummaryResponse>("/dashboard/summary", {
          method: "GET",
          auth: true,
          query: { month, year },
        }).catch(() => ({ income: 0 })),
      ]);

      const mappedBudgets = (budgetsResponse.budgets || []).map((budget) => {
        const color = budget.category_color || getCategoryColor(budget.category_name);

        return {
          id: budget.budget_id,
          categoryId: budget.category_id,
          name: budget.category_name,
          icon: getCategoryIcon(budget.category_name),
          color,
          lightColor: toLightColor(color),
          budget: Math.max(0, Math.round(toNumber(budget.monthly_limit))),
          spent: Math.max(0, Math.round(toNumber(budget.spent))),
          type: fixedCategories.has(budget.category_name) ? "fixed" : "flexible",
        } satisfies BudgetCategory;
      });

      const expenseCategories = (categoriesResponse.categories || []).filter(
        (category) => category.type !== "income"
      );

      setBudgets(mappedBudgets);
      setAvailableCategories(expenseCategories);
      setMonthlyIncome(Math.max(0, Math.round(toNumber(summaryResponse.income))));
      setDirtyBudgetIds(new Set());
      setIsDirty(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load budget data");
      }
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void fetchBudgetData();
  }, [fetchBudgetData]);

  const totalBudget = useMemo(() => budgets.reduce((sum, category) => sum + category.budget, 0), [budgets]);
  const totalSpent = useMemo(() => budgets.reduce((sum, category) => sum + category.spent, 0), [budgets]);
  const remaining = totalBudget - totalSpent;
  const budgetPercentage = monthlyIncome > 0 ? (totalBudget / monthlyIncome) * 100 : 0;

  const handleBudgetChange = (id: number, newBudget: number) => {
    const nextBudget = Math.max(0, Math.round(newBudget));

    setBudgets((prev) =>
      prev.map((category) =>
        category.id === id
          ? {
              ...category,
              budget: nextBudget,
            }
          : category
      )
    );

    setDirtyBudgetIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    setIsDirty(true);
  };

  const handleAddBudget = async (data: {
    category: string;
    limit: number;
    type: "fixed" | "flexible";
    alertThreshold: number;
    notes?: string;
  }) => {
    const selectedCategory = availableCategories.find((category) => category.name === data.category);

    if (!selectedCategory) {
      toast.error("Selected category is unavailable");
      return;
    }

    try {
      await apiRequest("/budgets", {
        method: "POST",
        auth: true,
        body: JSON.stringify({
          category_id: selectedCategory.category_id,
          monthly_limit: data.limit,
          month,
          year,
        }),
      });

      toast.success(`Budget category added: ${data.category}`);
      setAddModalOpen(false);
      await fetchBudgetData();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to add budget category");
      }
    }
  };

  const handleSaveBudgets = async () => {
    const changedBudgets = budgets.filter((budget) => dirtyBudgetIds.has(budget.id));

    if (changedBudgets.length === 0) {
      setIsDirty(false);
      return;
    }

    setIsSaving(true);

    try {
      await Promise.all(
        changedBudgets.map((budget) =>
          apiRequest("/budgets", {
            method: "POST",
            auth: true,
            body: JSON.stringify({
              category_id: budget.categoryId,
              monthly_limit: budget.budget,
              month,
              year,
            }),
          })
        )
      );

      toast.success("Budget saved successfully");
      await fetchBudgetData();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to save budget");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const existingCategoryNames = useMemo(() => budgets.map((budget) => budget.name), [budgets]);
  const availableCategoryNames = useMemo(
    () => availableCategories.map((category) => category.name),
    [availableCategories]
  );

  const getCategoryStatus = (spent: number, budget: number) => {
    if (budget <= 0) {
      return { status: "good", color: "#16a34a", text: "On track" };
    }

    const percentage = (spent / budget) * 100;
    if (percentage >= 100) return { status: "over", color: "#dc2626", text: "Over budget!" };
    if (percentage >= 90) return { status: "warning", color: "#ea580c", text: "Almost there" };
    return { status: "good", color: "#16a34a", text: "On track" };
  };

  const overBudget = useMemo(
    () => budgets.filter((category) => category.budget > 0 && category.spent > category.budget),
    [budgets]
  );
  const nearBudget = useMemo(
    () =>
      budgets.filter((category) => {
        if (category.budget <= 0) return false;
        const ratio = category.spent / category.budget;
        return ratio >= 0.9 && ratio < 1;
      }),
    [budgets]
  );
  const onTrackCount = useMemo(
    () => budgets.filter((category) => category.budget <= 0 || category.spent / category.budget < 0.9).length,
    [budgets]
  );

  if (loading) {
    return <div className="rounded-xl border bg-white p-6 text-sm text-zinc-500">Loading budget planner...</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <p className="text-sm text-red-600">{error}</p>
        <Button className="mt-3 rounded-xl" variant="outline" onClick={() => void fetchBudgetData()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1320px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold mb-1">Budget Planner</h2>
          <p className="text-sm text-foreground/60">Manage your spending limits by category</p>
        </div>

        <Button
          className="rounded-xl bg-primary hover:bg-primary/90"
          onClick={handleSaveBudgets}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">Monthly Income</span>
              <div className="w-10 h-10 rounded-xl bg-[#dcfce7] flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[#16a34a]" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-2">{formatPKR(monthlyIncome)}</div>
            <div className="text-sm text-foreground/60">Current month income</div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">Total Budget</span>
              <div className="w-10 h-10 rounded-xl bg-[#cffafe] flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#0891b2]" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-2">{formatPKR(totalBudget)}</div>
            <div className="text-sm text-foreground/60">{budgetPercentage.toFixed(0)}% of income</div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">Total Spent</span>
              <div className="w-10 h-10 rounded-xl bg-[#f3e8ff] flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-[#9333ea]" />
              </div>
            </div>
            <div className="text-2xl font-bold mb-2">{formatPKR(totalSpent)}</div>
            <div className="text-sm text-foreground/60">
              {totalBudget > 0 ? `${((totalSpent / totalBudget) * 100).toFixed(0)}% of budget` : "No budget set"}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card
            className={`p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow ${
              remaining < 0 ? "bg-red-50" : "bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">Remaining</span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${remaining < 0 ? "bg-red-100" : "bg-[#dcfce7]"}`}>
                {remaining < 0 ? (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-[#16a34a]" />
                )}
              </div>
            </div>
            <div className={`text-2xl font-bold mb-2 ${remaining < 0 ? "text-red-600" : "text-[#16a34a]"}`}>
              {formatPKR(Math.abs(remaining))}
            </div>
            <div className="text-sm text-foreground/60">{remaining < 0 ? "Over budget" : "Under budget"}</div>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Category Budgets</h3>
            <Button className="rounded-xl bg-primary hover:bg-primary/90" onClick={() => setAddModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </div>

          {budgets.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-foreground/60">
              No budget categories yet. Add your first category to get started.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {budgets.map((category, index) => {
                const percentage = category.budget > 0 ? (category.spent / category.budget) * 100 : 0;
                const Icon = category.icon;
                const status = getCategoryStatus(category.spent, category.budget);
                const left = category.budget - category.spent;
                const sliderMax = Math.max(5000, Math.ceil((category.budget * 2 || 5000) / 500) * 500);

                return (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.05 }}
                  >
                    <Card
                      className={`p-5 rounded-2xl border-2 transition-all ${
                        editingId === category.id ? "ring-2 ring-primary" : ""
                      }`}
                      style={{ backgroundColor: category.lightColor }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: category.color }}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold">{category.name}</h4>
                            <span className="text-xs text-foreground/60 capitalize">{category.type}</span>
                            {category.notes && (
                              <p className="text-xs text-foreground/50 mt-1 line-clamp-2 break-words">{category.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-foreground/60 mb-1">Spent</div>
                          <div className="text-lg font-bold">{formatPKR(category.spent)}</div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-foreground/60">{left > 0 ? `${formatPKR(left)} left` : "No budget left"}</span>
                            <span className="font-semibold" style={{ color: status.color }}>
                              {Math.max(0, Math.round(percentage))}%
                            </span>
                          </div>
                          <div className="w-full bg-white rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(percentage, 100)}%`,
                                backgroundColor: status.color,
                              }}
                            />
                          </div>
                        </div>

                        {status.status !== "good" && (
                          <div className="flex items-center gap-2 p-2 rounded-lg text-xs font-medium" style={{ backgroundColor: "white", color: status.color }}>
                            <AlertTriangle className="w-4 h-4" />
                            <span>{status.text}</span>
                          </div>
                        )}

                        <div className="pt-2">
                          <div className="flex items-center justify-between text-xs text-foreground/60 mb-2">
                            <span>Budget limit</span>
                            <span className="font-semibold">{formatPKR(category.budget)}</span>
                          </div>
                          <Slider
                            value={[category.budget]}
                            onValueChange={(value) => handleBudgetChange(category.id, value[0])}
                            min={0}
                            max={sliderMax}
                            step={500}
                            className="cursor-pointer"
                            onMouseDown={() => setEditingId(category.id)}
                            onMouseUp={() => setEditingId(null)}
                          />
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </Card>
      </motion.div>

      <AddBudgetCategoryModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onAdd={(data) => {
          void handleAddBudget(data);
        }}
        existingCategories={existingCategoryNames}
        categoryOptions={availableCategoryNames}
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="p-8 rounded-3xl border-2 bg-gradient-to-br from-[#dcfce7] to-[#cffafe]">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-3">Budget Recommendations</h3>
              <div className="space-y-3">
                {overBudget.length > 0 && (
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-[#ea580c] mt-0.5 flex-shrink-0" />
                    <p className="text-foreground/70 leading-relaxed">
                      <strong>{overBudget[0].name} is over budget.</strong> Reduce this category by around {formatPKR(overBudget[0].spent - overBudget[0].budget)} to return on track.
                    </p>
                  </div>
                )}

                {nearBudget.length > 0 && (
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-[#ea580c] mt-0.5 flex-shrink-0" />
                    <p className="text-foreground/70 leading-relaxed">
                      <strong>{nearBudget.length} category{nearBudget.length > 1 ? "ies are" : " is"} near limit.</strong> Watch spending closely before month end.
                    </p>
                  </div>
                )}

                {onTrackCount > 0 && (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#16a34a] mt-0.5 flex-shrink-0" />
                    <p className="text-foreground/70 leading-relaxed">
                      <strong>{onTrackCount} category{onTrackCount > 1 ? "ies are" : " is"} on track.</strong> Keep this pace to stay within your monthly plan.
                    </p>
                  </div>
                )}

                {budgets.length === 0 && (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#16a34a] mt-0.5 flex-shrink-0" />
                    <p className="text-foreground/70 leading-relaxed">
                      <strong>Start by adding budget categories.</strong> Once categories are set, recommendations will update from your live spending.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
