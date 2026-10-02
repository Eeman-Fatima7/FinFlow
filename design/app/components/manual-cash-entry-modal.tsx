import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Banknote, DollarSign, Calendar as CalendarIcon } from "lucide-react";
import { CategorySelect } from "./category-select";

interface ManualCashEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: {
    type: "expense" | "income";
    amount: number;
    merchant: string;
    category: string;
    date: string;
    notes?: string;
  }) => void;
}

export function ManualCashEntryModal({
  open,
  onOpenChange,
  onCreate,
}: ManualCashEntryModalProps) {
  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    type: "expense" as "expense" | "income",
    amount: "",
    merchant: "",
    category: "",
    date: today,
    notes: "",
  });

  const [errors, setErrors] = useState({
    amount: "",
    merchant: "",
    category: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validate = () => {
    const newErrors = {
      amount: "",
      merchant: "",
      category: "",
    };

    const amount = parseFloat(formData.amount);
    if (!formData.amount || amount <= 0) {
      newErrors.amount = "Please enter a valid amount greater than 0";
    }

    if (!formData.merchant.trim()) {
      newErrors.merchant = "Merchant/Description is required";
    }

    if (!formData.category) {
      newErrors.category = "Please select a category";
    }

    setErrors(newErrors);
    return !newErrors.amount && !newErrors.merchant && !newErrors.category;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    onCreate({
      type: formData.type,
      amount: parseFloat(formData.amount),
      merchant: formData.merchant,
      category: formData.category,
      date: formData.date,
      notes: formData.notes || undefined,
    });

    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setFormData({
      type: "expense",
      amount: "",
      merchant: "",
      category: "",
      date: today,
      notes: "",
    });
    setErrors({
      amount: "",
      merchant: "",
      category: "",
    });
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden">
        {/* Fixed Header */}
        <div className="shrink-0 px-6 pt-6 pb-4 border-b">
          <SheetHeader>
            <SheetTitle className="text-xl font-bold">Manual Cash Entry</SheetTitle>
            <SheetDescription className="text-sm">
              Add a cash transaction manually
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent hover:[&::-webkit-scrollbar-thumb]:bg-border/80">
          <form id="cash-entry-form" onSubmit={handleSubmit} className="px-6 py-6 space-y-6 pb-24">
            {/* Transaction Type Section */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold text-foreground">
                  Transaction Type
                </Label>
                <p className="text-xs text-foreground/60 mt-0.5">
                  Select if this is an expense or income
                </p>
              </div>
              <Tabs
                value={formData.type}
                onValueChange={(value) =>
                  handleInputChange("type", value as "expense" | "income")
                }
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 h-12 rounded-xl p-1 bg-accent">
                  <TabsTrigger
                    value="expense"
                    className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium"
                  >
                    💸 Expense
                  </TabsTrigger>
                  <TabsTrigger
                    value="income"
                    className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm font-medium"
                  >
                    💰 Income
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Payment Method Badge */}
            <div className="rounded-2xl bg-gradient-to-br from-[#dcfce7] to-[#cffafe] border-2 border-[#86efac]/20 px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#86efac] flex items-center justify-center">
                  <Banknote className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xs font-medium text-foreground/60">
                    Payment Method
                  </div>
                  <div className="font-semibold text-[#16a34a]">Cash</div>
                </div>
              </div>
              <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-[#86efac] text-white shadow-sm">
                💵 CASH
              </div>
            </div>

            {/* Details Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-4">
                  Transaction Details
                </h3>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-medium">
                  Amount *
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/60" />
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => handleInputChange("amount", e.target.value)}
                    className={`rounded-xl pl-10 h-11 text-base ${
                      errors.amount ? "border-red-500 focus-visible:ring-red-500/20" : ""
                    }`}
                    step="0.01"
                    min="0"
                  />
                </div>
                {errors.amount && (
                  <p className="text-xs text-red-600 font-medium">{errors.amount}</p>
                )}
              </div>

              {/* Merchant/Description */}
              <div className="space-y-2">
                <Label htmlFor="merchant" className="text-sm font-medium">
                  Merchant/Description *
                </Label>
                <p className="text-xs text-foreground/60 -mt-1">
                  Where you spent or received money
                </p>
                <Input
                  id="merchant"
                  placeholder="e.g., Coffee Shop, Grocery Store"
                  value={formData.merchant}
                  onChange={(e) => handleInputChange("merchant", e.target.value)}
                  className={`rounded-xl h-11 text-base ${
                    errors.merchant ? "border-red-500 focus-visible:ring-red-500/20" : ""
                  }`}
                />
                {errors.merchant && (
                  <p className="text-xs text-red-600 font-medium">{errors.merchant}</p>
                )}
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">
                  Category *
                </Label>
                <CategorySelect
                  value={formData.category}
                  onValueChange={(value) => handleInputChange("category", value)}
                />
                {errors.category && (
                  <p className="text-xs text-red-600 font-medium">{errors.category}</p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-medium">
                  Transaction Date
                </Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/60 pointer-events-none" />
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    className="rounded-xl h-11 text-base pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Optional Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-4">
                  Optional Information
                </h3>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium">
                  Notes
                </Label>
                <p className="text-xs text-foreground/60 -mt-1">
                  Add any additional context or details
                </p>
                <textarea
                  id="notes"
                  placeholder="e.g., Weekly groceries, Birthday gift..."
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  className="flex min-h-[100px] w-full rounded-xl border-2 border-input bg-background px-3 py-2.5 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  rows={4}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Sticky Footer */}
        <div className="shrink-0 px-6 py-4 border-t bg-background">
          <div className="space-y-3">
            <Button
              type="submit"
              form="cash-entry-form"
              className="w-full rounded-xl h-11 text-base font-semibold bg-primary hover:bg-primary/90 shadow-sm"
            >
              Add Cash Transaction
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl h-11 text-base font-medium"
              onClick={handleClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}