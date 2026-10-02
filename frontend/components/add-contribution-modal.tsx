"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useState } from "react";
import { formatMoney, usePreferences } from "@/lib/preferences";

type ContributionGoal = {
  name: string;
  current: number;
  target: number;
};

interface AddContributionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: ContributionGoal | null;
  onAdd: (contribution: { amount: number; date: string; note?: string }) => Promise<void> | void;
}

export function AddContributionModal({ open, onOpenChange, goal, onAdd }: AddContributionModalProps) {
  const { preferences } = usePreferences();
  const moneyFormatter = (value: number) =>
    formatMoney(Math.round(value || 0), preferences.currency, preferences.language);

  const today = new Date().toISOString().split('T')[0];
  
  const [formData, setFormData] = useState({
    amount: '',
    date: today,
    note: '',
  });

  const [errors, setErrors] = useState({
    amount: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {
      amount: '',
    };

    const amount = parseFloat(formData.amount);
    if (!formData.amount || amount <= 0) {
      newErrors.amount = 'Please enter a valid amount greater than 0';
    }

    setErrors(newErrors);
    return !newErrors.amount;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    await Promise.resolve(onAdd({
      amount: parseFloat(formData.amount),
      date: formData.date,
      note: formData.note,
    }));

    setIsLoading(false);
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setFormData({
      amount: '',
      date: today,
      note: '',
    });
    setErrors({
      amount: '',
    });
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const remaining = goal ? goal.target - goal.current : 0;

  return (
    <AnimatePresence>
      {open && goal && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <Card className="w-full max-w-lg rounded-3xl border-2">
              <form onSubmit={handleSubmit}>
                {/* Header */}
                <div className="border-b px-6 py-4 rounded-t-3xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">Add Contribution</h2>
                      <p className="text-sm text-foreground/60 mt-1">
                        Add money to: {goal.name}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleClose}
                      className="rounded-xl"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Form content */}
                <div className="p-6 space-y-6">
                  {/* Goal info card */}
                  <Card className="p-4 rounded-2xl bg-gradient-to-br from-accent to-white border-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-foreground/60 mb-1">Current</div>
                        <div className="text-xl font-bold">{moneyFormatter(goal.current)}</div>
                      </div>
                      <div>
                        <div className="text-foreground/60 mb-1">Remaining</div>
                        <div className="text-xl font-bold">{moneyFormatter(remaining)}</div>
                      </div>
                    </div>
                  </Card>

                  {/* Amount */}
                  <div className="space-y-2">
                    <Label htmlFor="contribution-amount">Amount *</Label>
                    <div className="relative">
                      <Input
                        id="contribution-amount"
                        type="number"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) => handleInputChange('amount', e.target.value)}
                        className={`rounded-xl ${errors.amount ? 'border-red-500' : ''}`}
                        step="0.01"
                        min="0"
                        autoFocus
                      />
                    </div>
                    {errors.amount && (
                      <p className="text-sm text-red-600">{errors.amount}</p>
                    )}
                  </div>

                  {/* Quick amount buttons */}
                  <div className="space-y-2">
                    <Label>Quick amounts</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[50, 100, 250, 500].map((amount) => (
                        <Button
                          key={amount}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleInputChange('amount', amount.toString())}
                          className="rounded-xl"
                        >
                          {moneyFormatter(amount)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Date */}
                  <div className="space-y-2">
                    <Label htmlFor="contribution-date">Date</Label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/60" />
                      <Input
                        id="contribution-date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleInputChange('date', e.target.value)}
                        className="rounded-xl pl-10"
                      />
                    </div>
                  </div>

                  {/* Note */}
                  <div className="space-y-2">
                    <Label htmlFor="contribution-note">Note (Optional)</Label>
                    <textarea
                      id="contribution-note"
                      placeholder="Add a note about this contribution..."
                      value={formData.note}
                      onChange={(e) => handleInputChange('note', e.target.value)}
                      className="flex min-h-[80px] w-full rounded-xl border-2 border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t px-6 py-4 rounded-b-3xl flex gap-3 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    className="rounded-xl"
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="rounded-xl"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Adding...' : 'Add Contribution'}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
