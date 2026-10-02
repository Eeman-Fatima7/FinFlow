import { Card } from "../components/ui/card";
import { Slider } from "../components/ui/slider";
import { Button } from "../components/ui/button";
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
  Tag
} from "lucide-react";
import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { AddBudgetCategoryModal } from "../components/add-budget-category-modal";
import { useCategories } from "../providers/categories-provider";
import { toast } from "sonner";

// Icon mapping for common categories
const categoryIcons: Record<string, any> = {
  "Housing": Home,
  "Transportation": Car,
  "Groceries": ShoppingCart,
  "Shopping": ShoppingCart,
  "Dining Out": Utensils,
  "Food & Drink": Utensils,
  "Subscriptions": Tv,
  "Healthcare": Heart,
  "Health": Heart,
  "Bills & Utilities": CreditCard,
  "Bills": CreditCard,
  "Entertainment": Tv,
  "Travel": Car,
  "Education": Tag,
  "Personal Care": Heart,
  "Gifts": Tag,
  "Insurance": CreditCard,
  "Savings": DollarSign,
  "Other": Tag,
  "Income": DollarSign,
};

// Get default icon for a category
const getCategoryIcon = (categoryName: string) => {
  return categoryIcons[categoryName] || Tag;
};

type BudgetCategory = {
  id: number;
  name: string;
  icon: any;
  color: string;
  lightColor: string;
  budget: number;
  spent: number;
  type: "fixed" | "flexible";
  alertThreshold?: number;
  notes?: string;
};

const initialCategories: BudgetCategory[] = [
  {
    id: 1,
    name: "Housing",
    icon: Home,
    color: "#93c5fd",
    lightColor: "#dbeafe",
    budget: 1800,
    spent: 1800,
    type: "fixed"
  },
  {
    id: 2,
    name: "Transportation",
    icon: Car,
    color: "#67e8f9",
    lightColor: "#cffafe",
    budget: 400,
    spent: 320,
    type: "flexible"
  },
  {
    id: 3,
    name: "Groceries",
    icon: ShoppingCart,
    color: "#86efac",
    lightColor: "#dcfce7",
    budget: 500,
    spent: 412,
    type: "flexible"
  },
  {
    id: 4,
    name: "Dining Out",
    icon: Utensils,
    color: "#f9a8d4",
    lightColor: "#fce7f3",
    budget: 300,
    spent: 340,
    type: "flexible"
  },
  {
    id: 5,
    name: "Subscriptions",
    icon: Tv,
    color: "#c084fc",
    lightColor: "#f3e8ff",
    budget: 150,
    spent: 145,
    type: "fixed"
  },
  {
    id: 6,
    name: "Healthcare",
    icon: Heart,
    color: "#fda4af",
    lightColor: "#ffe4e6",
    budget: 200,
    spent: 85,
    type: "flexible"
  },
  {
    id: 7,
    name: "Shopping",
    icon: ShoppingCart,
    color: "#c084fc",
    lightColor: "#f3e8ff",
    budget: 300,
    spent: 267,
    type: "flexible"
  },
  {
    id: 8,
    name: "Bills & Utilities",
    icon: CreditCard,
    color: "#67e8f9",
    lightColor: "#cffafe",
    budget: 250,
    spent: 235,
    type: "fixed"
  },
];

export function BudgetPlanner() {
  const { getCategoryColor } = useCategories();
  const [budgets, setBudgets] = useState<BudgetCategory[]>(initialCategories);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load saved budgets from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("finflow.budgets");
      if (saved) {
        const parsedBudgets = JSON.parse(saved);
        // Restore icon references for loaded budgets
        const budgetsWithIcons = parsedBudgets.map((budget: any) => ({
          ...budget,
          icon: getCategoryIcon(budget.name),
        }));
        setBudgets(budgetsWithIcons);
      }
    } catch (error) {
      console.error("Failed to load budgets:", error);
      toast.error("Failed to load saved budgets");
    }
  }, []);

  const totalBudget = budgets.reduce((sum, cat) => sum + cat.budget, 0);
  const totalSpent = budgets.reduce((sum, cat) => sum + cat.spent, 0);
  const remaining = totalBudget - totalSpent;
  const monthlyIncome = 8400;
  const budgetPercentage = (totalBudget / monthlyIncome) * 100;

  const handleBudgetChange = (id: number, newBudget: number) => {
    setBudgets(prev => prev.map(cat => 
      cat.id === id ? { ...cat, budget: newBudget } : cat
    ));
    setIsDirty(true);
  };

  const handleAddBudget = (data: {
    category: string;
    limit: number;
    type: "fixed" | "flexible";
    alertThreshold: number;
    notes?: string;
  }) => {
    // Get color for the category
    const color = getCategoryColor(data.category);
    
    // Create lighter version of color (simple opacity adjustment)
    const lightColor = color + "33"; // Add transparency
    
    // Get icon for the category
    const icon = getCategoryIcon(data.category);
    
    // Create new budget category
    const newBudget: BudgetCategory = {
      id: Math.max(...budgets.map(b => b.id), 0) + 1,
      name: data.category,
      icon,
      color,
      lightColor,
      budget: data.limit,
      spent: 0, // New budgets start with 0 spent
      type: data.type,
      alertThreshold: data.alertThreshold,
      notes: data.notes,
    };
    
    setBudgets(prev => [...prev, newBudget]);
    setIsDirty(true);
    toast.success(`Budget category added: ${data.category}`);
  };

  const handleSaveBudgets = async () => {
    setIsSaving(true);
    try {
      // Prepare budgets for storage (remove icon function references)
      const budgetsToSave = budgets.map(({ icon, ...budget }) => budget);
      localStorage.setItem("finflow.budgets", JSON.stringify(budgetsToSave));
      setIsDirty(false);
      toast.success("Budget saved successfully");
    } catch (error) {
      console.error("Failed to save budgets:", error);
      toast.error("Failed to save budget");
    } finally {
      setIsSaving(false);
    }
  };

  // Get list of existing category names for duplicate check
  const existingCategoryNames = budgets.map(b => b.name);

  const getCategoryStatus = (spent: number, budget: number) => {
    const percentage = (spent / budget) * 100;
    if (percentage >= 100) return { status: 'over', color: '#dc2626', text: 'Over budget!' };
    if (percentage >= 90) return { status: 'warning', color: '#ea580c', text: 'Almost there' };
    return { status: 'good', color: '#16a34a', text: 'On track' };
  };

  return (
    <div className="space-y-6 max-w-[1320px] mx-auto">
      {/* Header */}
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

      {/* Overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">Monthly Income</span>
              <div className="w-10 h-10 rounded-xl bg-[#dcfce7] flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[#16a34a]" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">${monthlyIncome.toLocaleString()}</div>
            <div className="text-sm text-foreground/60">After tax</div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">Total Budget</span>
              <div className="w-10 h-10 rounded-xl bg-[#cffafe] flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#0891b2]" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">${totalBudget.toLocaleString()}</div>
            <div className="text-sm text-foreground/60">{budgetPercentage.toFixed(0)}% of income</div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">Total Spent</span>
              <div className="w-10 h-10 rounded-xl bg-[#f3e8ff] flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-[#9333ea]" />
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">${totalSpent.toLocaleString()}</div>
            <div className="text-sm text-foreground/60">
              {((totalSpent / totalBudget) * 100).toFixed(0)}% of budget
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className={`p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow ${
            remaining < 0 ? 'bg-red-50' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-foreground/60">Remaining</span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                remaining < 0 ? 'bg-red-100' : 'bg-[#dcfce7]'
              }`}>
                {remaining < 0 ? (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-[#16a34a]" />
                )}
              </div>
            </div>
            <div className={`text-3xl font-bold mb-2 ${
              remaining < 0 ? 'text-red-600' : 'text-[#16a34a]'
            }`}>
              ${Math.abs(remaining).toLocaleString()}
            </div>
            <div className="text-sm text-foreground/60">
              {remaining < 0 ? 'Over budget' : 'Under budget'}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Budget breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Category Budgets</h3>
            <Button
              className="rounded-xl bg-primary hover:bg-primary/90"
              onClick={() => setAddModalOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">{budgets.map((category, index) => {
            const percentage = (category.spent / category.budget) * 100;
            const Icon = category.icon;
            const status = getCategoryStatus(category.spent, category.budget);
            const remaining = category.budget - category.spent;

            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.05 }}
              >
                <Card 
                  className={`p-5 rounded-2xl border-2 transition-all ${
                    editingId === category.id ? 'ring-2 ring-primary' : ''
                  }`}
                  style={{ backgroundColor: category.lightColor }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: category.color }}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold">{category.name}</h4>
                        <span className="text-xs text-foreground/60 capitalize">{category.type}</span>
                        {category.notes && (
                          <p className="text-xs text-foreground/50 mt-1 line-clamp-2 break-words">
                            {category.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-foreground/60 mb-1">Spent</div>
                      <div className="text-lg font-bold">${category.spent}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-foreground/60">
                          ${remaining > 0 ? remaining : 0} left
                        </span>
                        <span 
                          className="font-semibold"
                          style={{ color: status.color }}
                        >
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-white rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${Math.min(percentage, 100)}%`,
                            backgroundColor: status.color
                          }}
                        />
                      </div>
                    </div>

                    {status.status !== 'good' && (
                      <div 
                        className="flex items-center gap-2 p-2 rounded-lg text-xs font-medium"
                        style={{ 
                          backgroundColor: 'white',
                          color: status.color
                        }}
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <span>{status.text}</span>
                      </div>
                    )}

                    <div className="pt-2">
                      <div className="flex items-center justify-between text-xs text-foreground/60 mb-2">
                        <span>Budget limit</span>
                        <span className="font-semibold">${category.budget}</span>
                      </div>
                      <Slider
                        value={[category.budget]}
                        onValueChange={(value) => handleBudgetChange(category.id, value[0])}
                        min={0}
                        max={2000}
                        step={50}
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
        </Card>
      </motion.div>

      {/* Add Category Modal */}
      <AddBudgetCategoryModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onAdd={handleAddBudget}
        existingCategories={existingCategoryNames}
      />

      {/* Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="p-8 rounded-3xl border-2 bg-gradient-to-br from-[#dcfce7] to-[#cffafe]">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-3">Budget Recommendations</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#16a34a] mt-0.5 flex-shrink-0" />
                  <p className="text-foreground/70 leading-relaxed">
                    <strong>Great job on housing!</strong> Your rent is within the recommended 30% of income.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#ea580c] mt-0.5 flex-shrink-0" />
                  <p className="text-foreground/70 leading-relaxed">
                    <strong>Dining out is over budget.</strong> Consider reducing by $100/month by meal prepping 2-3 times per week.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#16a34a] mt-0.5 flex-shrink-0" />
                  <p className="text-foreground/70 leading-relaxed">
                    <strong>Subscriptions are well managed.</strong> You're using 97% of your subscription budget efficiently.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}