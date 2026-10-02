import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { CategorySelect } from "./category-select";
import { DollarSign } from "lucide-react";

interface AddBudgetCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (budget: {
    category: string;
    limit: number;
    type: "fixed" | "flexible";
    alertThreshold: number;
    notes?: string;
  }) => void;
  existingCategories: string[];
  categoryOptions?: string[];
}

export function AddBudgetCategoryModal({
  open,
  onOpenChange,
  onAdd,
  existingCategories,
  categoryOptions,
}: AddBudgetCategoryModalProps) {
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [type, setType] = useState<"fixed" | "flexible">("flexible");
  const [alertThreshold, setAlertThreshold] = useState(90);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState({ category: "", limit: "" });

  const suggestedLimits = [100, 200, 500, 1000];

  const resetForm = () => {
    setCategory("");
    setLimit("");
    setType("flexible");
    setAlertThreshold(90);
    setNotes("");
    setErrors({ category: "", limit: "" });
  };

  const validate = () => {
    const newErrors = { category: "", limit: "" };
    let isValid = true;

    if (!category) {
      newErrors.category = "Please select a category";
      isValid = false;
    } else if (existingCategories.some(c => c.toLowerCase() === category.toLowerCase())) {
      newErrors.category = "This category already has a budget";
      isValid = false;
    }

    const limitNum = parseFloat(limit);
    if (!limit || isNaN(limitNum) || limitNum <= 0) {
      newErrors.limit = "Please enter a valid budget limit";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    onAdd({
      category,
      limit: parseFloat(limit),
      type,
      alertThreshold,
      notes: notes.trim() || undefined,
    });

    resetForm();
    onOpenChange(false);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add Budget Category</DialogTitle>
          <DialogDescription>
            Set a monthly spending limit for a category
          </DialogDescription>
        </DialogHeader>

        <form id="add-budget-form" onSubmit={handleSubmit} className="space-y-5 flex-1 overflow-y-auto px-1 scrollbar-hide">
          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <CategorySelect
              value={category}
              onValueChange={(value) => {
                setCategory(value);
                if (errors.category) {
                  setErrors(prev => ({ ...prev, category: "" }));
                }
              }}
              options={categoryOptions}
              placeholder="Select a category"
              required
            />
            {errors.category && (
              <p className="text-xs text-red-600 font-medium">{errors.category}</p>
            )}
          </div>

          {/* Monthly Budget Limit */}
          <div className="space-y-2">
            <Label htmlFor="limit">Monthly Budget Limit *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/60" />
              <Input
                id="limit"
                type="number"
                placeholder="0.00"
                value={limit}
                onChange={(e) => {
                  setLimit(e.target.value);
                  if (errors.limit) {
                    setErrors(prev => ({ ...prev, limit: "" }));
                  }
                }}
                className={`pl-10 rounded-xl ${
                  errors.limit ? "border-red-500 focus-visible:ring-red-500/20" : ""
                }`}
                step="0.01"
                min="0"
              />
            </div>
            {errors.limit && (
              <p className="text-xs text-red-600 font-medium">{errors.limit}</p>
            )}

            {/* Suggested limits */}
            <div className="flex flex-wrap gap-2">
              {suggestedLimits.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setLimit(amount.toString())}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent hover:bg-accent/80 transition-colors"
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          {/* Budget Type */}
          <div className="space-y-2">
            <Label>Budget Type</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType("flexible")}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border-2 ${
                  type === "flexible"
                    ? "bg-gradient-to-r from-[#dcfce7] to-[#cffafe] text-primary border-[#86efac]"
                    : "bg-accent/50 text-foreground/70 border-transparent hover:bg-accent"
                }`}
              >
                Flexible
              </button>
              <button
                type="button"
                onClick={() => setType("fixed")}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border-2 ${
                  type === "fixed"
                    ? "bg-gradient-to-r from-[#dcfce7] to-[#cffafe] text-primary border-[#86efac]"
                    : "bg-accent/50 text-foreground/70 border-transparent hover:bg-accent"
                }`}
              >
                Fixed
              </button>
            </div>
          </div>

          {/* Alert Threshold */}
          <div className="space-y-2">
            <Label htmlFor="alert-threshold">Alert Threshold</Label>
            <p className="text-xs text-foreground/60">
              Get notified when you reach this percentage of your budget
            </p>
            <select
              id="alert-threshold"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-accent/50 border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={80}>80%</option>
              <option value={90}>90%</option>
              <option value={100}>100%</option>
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              placeholder="Add any notes about this budget..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex min-h-[80px] w-full rounded-xl border-2 border-input bg-background px-3 py-2.5 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              rows={3}
            />
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-budget-form"
            className="rounded-xl"
          >
            Add Budget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}