import { motion, AnimatePresence } from "motion/react";
import { X, Target, Home, Plane, GraduationCap, Car, Heart, Smartphone, Gift } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";

const goalIcons = [
  { name: 'Emergency', icon: Target, color: '#93c5fd' },
  { name: 'Vacation', icon: Plane, color: '#f9a8d4' },
  { name: 'Car', icon: Car, color: '#67e8f9' },
  { name: 'Education', icon: GraduationCap, color: '#c084fc' },
  { name: 'Home', icon: Home, color: '#86efac' },
  { name: 'Wedding', icon: Heart, color: '#fda4af' },
  { name: 'Gadget', icon: Smartphone, color: '#a5b4fc' },
  { name: 'Other', icon: Gift, color: '#fbbf24' },
];

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGoal: (goal: NewGoal) => void;
}

export interface NewGoal {
  name: string;
  icon: LucideIcon;
  color: string;
  lightColor: string;
  target: number;
  targetDate: string;
  monthlyContribution: number;
  startingAmount: number;
  notes: string;
}

export function CreateGoalModal({ isOpen, onClose, onCreateGoal }: CreateGoalModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    selectedIconIndex: 0,
    targetAmount: '',
    targetMonth: '',
    targetYear: '',
    monthlyContribution: '',
    startingAmount: '',
    notes: '',
  });

  const [errors, setErrors] = useState({
    name: '',
    targetAmount: '',
    targetDate: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {
      name: '',
      targetAmount: '',
      targetDate: '',
    };

    if (!formData.name.trim()) {
      newErrors.name = 'Goal name is required';
    }

    if (!formData.targetAmount || parseFloat(formData.targetAmount) <= 0) {
      newErrors.targetAmount = 'Please enter a valid target amount';
    }

    if (!formData.targetMonth || !formData.targetYear) {
      newErrors.targetDate = 'Please select a target date';
    }

    setErrors(newErrors);
    return !newErrors.name && !newErrors.targetAmount && !newErrors.targetDate;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));

    const selectedIcon = goalIcons[formData.selectedIconIndex];
    const newGoal: NewGoal = {
      name: formData.name,
      icon: selectedIcon.icon,
      color: selectedIcon.color,
      lightColor: selectedIcon.color + '20', // Add transparency
      target: parseFloat(formData.targetAmount),
      targetDate: `${formData.targetMonth} ${formData.targetYear}`,
      monthlyContribution: parseFloat(formData.monthlyContribution) || 0,
      startingAmount: parseFloat(formData.startingAmount) || 0,
      notes: formData.notes,
    };

    onCreateGoal(newGoal);
    setIsLoading(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      selectedIconIndex: 0,
      targetAmount: '',
      targetMonth: '',
      targetYear: '',
      monthlyContribution: '',
      startingAmount: '',
      notes: '',
    });
    setErrors({
      name: '',
      targetAmount: '',
      targetDate: '',
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + i);

  return (
    <AnimatePresence>
      {isOpen && (
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
            <Card className="w-full max-w-2xl max-h-[90dvh] rounded-3xl border-2 flex flex-col overflow-hidden">
              <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="shrink-0 bg-background border-b px-6 py-4 rounded-t-3xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">Create New Goal</h2>
                      <p className="text-sm text-foreground/60 mt-1">Set your target and start saving</p>
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
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-6 scrollbar-hide">
                  <div className="space-y-6">
                    {/* Goal Name */}
                    <div className="space-y-2">
                      <Label htmlFor="goal-name">Goal Name *</Label>
                      <Input
                        id="goal-name"
                        placeholder="e.g., Emergency Fund, Dream Vacation"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className={`rounded-xl ${errors.name ? 'border-red-500' : ''}`}
                      />
                      {errors.name && (
                        <p className="text-sm text-red-600">{errors.name}</p>
                      )}
                    </div>

                    {/* Icon Picker */}
                    <div className="space-y-3">
                      <Label>Choose an Icon</Label>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                        {goalIcons.map((item, index) => {
                          const Icon = item.icon;
                          const isSelected = formData.selectedIconIndex === index;
                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handleInputChange('selectedIconIndex', index.toString())}
                              className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all hover:shadow-md ${
                                isSelected
                                  ? 'border-primary bg-accent shadow-md'
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: item.color }}
                              >
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              <span className="text-xs font-medium">{item.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Target Amount */}
                    <div className="space-y-2">
                      <Label htmlFor="target-amount">Target Amount *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/60">
                          $
                        </span>
                        <Input
                          id="target-amount"
                          type="number"
                          placeholder="0.00"
                          value={formData.targetAmount}
                          onChange={(e) => handleInputChange('targetAmount', e.target.value)}
                          className={`rounded-xl pl-8 ${errors.targetAmount ? 'border-red-500' : ''}`}
                          step="0.01"
                          min="0"
                        />
                      </div>
                      {errors.targetAmount && (
                        <p className="text-sm text-red-600">{errors.targetAmount}</p>
                      )}
                    </div>

                    {/* Target Date */}
                    <div className="space-y-2">
                      <Label>Target Date *</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={formData.targetMonth}
                          onChange={(e) => handleInputChange('targetMonth', e.target.value)}
                          className={`flex h-10 w-full rounded-xl border-2 border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            errors.targetDate ? 'border-red-500' : ''
                          }`}
                        >
                          <option value="">Month</option>
                          {months.map((month) => (
                            <option key={month} value={month}>
                              {month}
                            </option>
                          ))}
                        </select>
                        <select
                          value={formData.targetYear}
                          onChange={(e) => handleInputChange('targetYear', e.target.value)}
                          className={`flex h-10 w-full rounded-xl border-2 border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                            errors.targetDate ? 'border-red-500' : ''
                          }`}
                        >
                          <option value="">Year</option>
                          {years.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </div>
                      {errors.targetDate && (
                        <p className="text-sm text-red-600">{errors.targetDate}</p>
                      )}
                    </div>

                    {/* Monthly Contribution */}
                    <div className="space-y-2">
                      <Label htmlFor="monthly-contribution">Monthly Contribution</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/60">
                          $
                        </span>
                        <Input
                          id="monthly-contribution"
                          type="number"
                          placeholder="0.00"
                          value={formData.monthlyContribution}
                          onChange={(e) => handleInputChange('monthlyContribution', e.target.value)}
                          className="rounded-xl pl-8"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <p className="text-xs text-foreground/60">How much will you save each month?</p>
                    </div>

                    {/* Starting Amount */}
                    <div className="space-y-2">
                      <Label htmlFor="starting-amount">Starting Amount (Optional)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/60">
                          $
                        </span>
                        <Input
                          id="starting-amount"
                          type="number"
                          placeholder="0.00"
                          value={formData.startingAmount}
                          onChange={(e) => handleInputChange('startingAmount', e.target.value)}
                          className="rounded-xl pl-8"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <p className="text-xs text-foreground/60">Already saved something? Add it here</p>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <textarea
                        id="notes"
                        placeholder="Add any additional details about your goal..."
                        value={formData.notes}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        className="flex min-h-[80px] w-full rounded-xl border-2 border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 bg-background border-t px-6 py-4 rounded-b-3xl flex gap-3 justify-end">
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
                    {isLoading ? 'Creating...' : 'Create Goal'}
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