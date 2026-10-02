import { motion, AnimatePresence } from "motion/react";
import { X, Target, Home, Plane, GraduationCap, Car, Heart, Smartphone, Gift } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useState, useEffect } from "react";
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

interface EditGoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: any;
  onSave: (updatedGoal: any) => void;
}

export function EditGoalModal({ open, onOpenChange, goal, onSave }: EditGoalModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    selectedIconIndex: 0,
    targetAmount: '',
    targetMonth: '',
    targetYear: '',
    monthlyContribution: '',
  });

  const [errors, setErrors] = useState({
    name: '',
    targetAmount: '',
    targetDate: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  // Prefill form when goal changes
  useEffect(() => {
    if (goal && open) {
      // Find icon index
      const iconIndex = goalIcons.findIndex(item => item.color === goal.color);
      
      // Parse expected date (e.g., "Mar 2027")
      const dateParts = goal.expectedDate.split(' ');
      const month = dateParts[0] || '';
      const year = dateParts[1] || '';

      setFormData({
        name: goal.name,
        selectedIconIndex: iconIndex >= 0 ? iconIndex : 0,
        targetAmount: goal.target.toString(),
        targetMonth: month,
        targetYear: year,
        monthlyContribution: goal.monthlyContribution.toString(),
      });
    }
  }, [goal, open]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
    await new Promise(resolve => setTimeout(resolve, 500));

    const selectedIcon = goalIcons[formData.selectedIconIndex];
    const updatedGoal = {
      name: formData.name,
      icon: selectedIcon.icon,
      color: selectedIcon.color,
      lightColor: selectedIcon.color + '20',
      target: parseFloat(formData.targetAmount),
      expectedDate: `${formData.targetMonth} ${formData.targetYear}`,
      monthlyContribution: parseFloat(formData.monthlyContribution) || 0,
    };

    onSave(updatedGoal);
    setIsLoading(false);
    onOpenChange(false);
  };

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + i);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
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
                      <h2 className="text-2xl font-bold">Edit Goal</h2>
                      <p className="text-sm text-foreground/60 mt-1">Update your goal details</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onOpenChange(false)}
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
                      <Label htmlFor="edit-goal-name">Goal Name *</Label>
                      <Input
                        id="edit-goal-name"
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
                      <Label htmlFor="edit-target-amount">Target Amount *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/60">
                          $
                        </span>
                        <Input
                          id="edit-target-amount"
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
                      <Label htmlFor="edit-monthly-contribution">Monthly Contribution</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/60">
                          $
                        </span>
                        <Input
                          id="edit-monthly-contribution"
                          type="number"
                          placeholder="0.00"
                          value={formData.monthlyContribution}
                          onChange={(e) => handleInputChange('monthlyContribution', e.target.value)}
                          className="rounded-xl pl-8"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 bg-background border-t px-6 py-4 rounded-b-3xl flex gap-3 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
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
                    {isLoading ? 'Saving...' : 'Save Changes'}
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