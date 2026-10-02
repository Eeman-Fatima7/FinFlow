'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  Target,
  Home,
  Plane,
  GraduationCap,
  Car,
  Calendar,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, apiRequest } from '@/lib/api';
import { formatMoney, usePreferences } from '@/lib/preferences';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreateGoalModal, type NewGoal } from '@/components/create-goal-modal';
import { EditGoalModal } from '@/components/edit-goal-modal';
import { AddContributionModal } from '@/components/add-contribution-modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type GoalApi = {
  goal_id: number;
  title: string;
  target_amount: string;
  current_savings: string;
  deadline: string | null;
  status: 'active' | 'completed' | 'paused';
  progress_percentage: string | null;
};

type GoalCard = {
  id: number;
  name: string;
  icon: typeof Target;
  color: string;
  lightColor: string;
  current: number;
  target: number;
  monthlyContribution: number;
  expectedDate: string;
  category: string;
  status: 'active' | 'completed' | 'paused';
};

const iconCycle = [Target, Plane, Car, GraduationCap, Home];
const colorCycle = ['#93c5fd', '#f9a8d4', '#67e8f9', '#c084fc', '#86efac'];
const lightCycle = ['#dbeafe', '#fce7f3', '#cffafe', '#f3e8ff', '#dcfce7'];

const formatExpectedDate = (deadline: string | null) => {
  if (!deadline) return 'No deadline';
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return 'No deadline';
  return parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const toIsoDate = (expectedDate: string) => {
  if (!expectedDate || expectedDate === 'No deadline') return null;
  const parsed = new Date(`1 ${expectedDate}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
};

export default function GoalsPage() {
  const { preferences } = usePreferences();
  const moneyFormatter = (value: number) =>
    formatMoney(Math.round(value || 0), preferences.currency, preferences.language);

  const [goals, setGoals] = useState<GoalCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [contributionOpen, setContributionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const newGoalRef = useRef<HTMLDivElement>(null);

  const fetchGoals = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest<{ goals: GoalApi[] }>('/goals', {
        method: 'GET',
        auth: true,
      });

      const mapped = data.goals.map((goal, index) => {
        const icon = iconCycle[index % iconCycle.length];
        const color = colorCycle[index % colorCycle.length];
        const lightColor = lightCycle[index % lightCycle.length];

        return {
          id: goal.goal_id,
          name: goal.title,
          icon,
          color,
          lightColor,
          current: Number(goal.current_savings),
          target: Number(goal.target_amount),
          monthlyContribution: 0,
          expectedDate: formatExpectedDate(goal.deadline),
          category: 'custom',
          status: goal.status,
        } satisfies GoalCard;
      });

      setGoals(mapped);
      if (mapped.length > 0) {
        setSelectedGoalId((prev) => prev ?? mapped[0].id);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load goals');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchGoals();
  }, []);

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalId) || goals[0] || null,
    [goals, selectedGoalId]
  );

  const totals = useMemo(() => {
    const totalSaved = goals.reduce((sum, goal) => sum + goal.current, 0);
    const totalTarget = goals.reduce((sum, goal) => sum + goal.target, 0);
    const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    return { totalSaved, totalTarget, overallProgress };
  }, [goals]);

  const handleCreateGoal = async (newGoalData: NewGoal) => {
    try {
      const targetAmount = Number(newGoalData.target);
      if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
        toast.error('Please enter a valid target amount');
        return;
      }

      await apiRequest('/goals', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          title: newGoalData.name,
          target_amount: targetAmount,
          deadline: toIsoDate(newGoalData.targetDate),
        }),
      });

      await fetchGoals();
      setIsCreateModalOpen(false);
      toast.success('Goal created successfully');

      requestAnimationFrame(() => {
        newGoalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
        setError(err.message);
      } else {
        toast.error('Failed to create goal');
      }
    }
  };

  const handleEditGoal = async (updatedFields: {
    name: string;
    target: number;
    expectedDate: string;
  }) => {
    if (!selectedGoal) return;

    try {
      await apiRequest(`/goals/${selectedGoal.id}`, {
        method: 'PUT',
        auth: true,
        body: JSON.stringify({
          title: updatedFields.name,
          target_amount: Number(updatedFields.target),
          deadline: toIsoDate(updatedFields.expectedDate),
        }),
      });

      await fetchGoals();
      setEditOpen(false);
      toast.success('Goal updated successfully');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
        setError(err.message);
      } else {
        toast.error('Failed to update goal');
      }
    }
  };

  const handleAddContribution = async (contribution: { amount: number }) => {
    if (!selectedGoal) return;

    if (contribution.amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    try {
      const nextAmount = Math.min(selectedGoal.target, selectedGoal.current + contribution.amount);

      await apiRequest(`/goals/${selectedGoal.id}`, {
        method: 'PUT',
        auth: true,
        body: JSON.stringify({
          current_savings: nextAmount,
        }),
      });

      await fetchGoals();
      setContributionOpen(false);
      toast.success('Contribution added successfully');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
        setError(err.message);
      } else {
        toast.error('Failed to add contribution');
      }
    }
  };

  const handleDeleteGoal = async () => {
    if (!selectedGoal) return;

    try {
      await apiRequest(`/goals/${selectedGoal.id}`, {
        method: 'DELETE',
        auth: true,
      });

      setDeleteOpen(false);
      await fetchGoals();
      toast.success('Goal deleted');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
        setError(err.message);
      } else {
        toast.error('Failed to delete goal');
      }
    }
  };

  if (loading) {
    return <div className="rounded-xl border bg-white p-6 text-sm text-zinc-500">Loading goals...</div>;
  }

  return (
    <div className="space-y-6 max-w-[1320px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold mb-1">Savings Goals</h2>
          <p className="text-sm text-foreground/60">Track your progress toward your financial dreams</p>
        </div>

        <Button className="rounded-xl bg-primary hover:bg-primary/90" onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Goal
        </Button>
      </motion.div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-8 rounded-3xl border-2 bg-gradient-to-br from-[#dcfce7] via-[#cffafe] to-[#dbeafe]">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="text-sm text-foreground/60 mb-2">Total Saved</div>
              <div className="text-4xl font-bold mb-1">{moneyFormatter(totals.totalSaved)}</div>
              <div className="text-sm text-foreground/60">of {moneyFormatter(totals.totalTarget)} goal</div>
            </div>
            <div>
              <div className="text-sm text-foreground/60 mb-2">Overall Progress</div>
              <div className="text-4xl font-bold mb-3">{totals.overallProgress.toFixed(0)}%</div>
              <div className="w-full bg-white rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#86efac] via-[#67e8f9] to-[#93c5fd] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(totals.overallProgress, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="text-sm text-foreground/60 mb-2">Active Goals</div>
              <div className="text-4xl font-bold mb-1">{goals.length}</div>
              <div className="text-sm text-foreground/60">across all categories</div>
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {goals.map((goal, index) => {
          const progress = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
          const remaining = Math.max(0, goal.target - goal.current);
          const Icon = goal.icon;
          const isLast = index === goals.length - 1;

          return (
            <motion.div
              key={goal.id}
              ref={isLast ? newGoalRef : null}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.08 }}
              whileHover={{ y: -4 }}
            >
              <Card
                className="p-6 rounded-3xl border-2 hover:shadow-xl transition-all cursor-pointer"
                onClick={() => setSelectedGoalId(goal.id)}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: goal.color }}
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-1">{goal.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-foreground/60">
                        <Calendar className="w-4 h-4" />
                        <span>{goal.expectedDate}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <div className="text-3xl font-bold">{moneyFormatter(goal.current)}</div>
                        <div className="text-sm text-foreground/60">of {moneyFormatter(goal.target)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold" style={{ color: goal.color }}>
                          {progress.toFixed(0)}%
                        </div>
                        <div className="text-sm text-foreground/60">complete</div>
                      </div>
                    </div>

                    <div className="w-full bg-accent rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: goal.color }}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl" style={{ backgroundColor: goal.lightColor }}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-foreground/60 mb-1">Remaining</div>
                        <div className="text-lg font-bold">{moneyFormatter(remaining)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-foreground/60 mb-1">Status</div>
                        <div className="text-lg font-bold capitalize">{goal.status}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {selectedGoal && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="p-8 rounded-3xl border-2">
            <h3 className="text-xl font-bold mb-6">Goal Insights: {selectedGoal.name}</h3>

            <div className="grid md:grid-cols-3 gap-6">
              <Card className="p-6 rounded-2xl bg-[#dcfce7] border-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#86efac] flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm text-foreground/60">Progress</div>
                </div>
                <div className="text-2xl font-bold mb-1">{((selectedGoal.current / selectedGoal.target) * 100 || 0).toFixed(0)}%</div>
                <div className="text-sm text-foreground/70 leading-relaxed">Keep adding contributions to hit your target faster.</div>
              </Card>

              <Card className="p-6 rounded-2xl bg-[#f3e8ff] border-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#c084fc] flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm text-foreground/60">Timeline</div>
                </div>
                <div className="text-2xl font-bold mb-1">{selectedGoal.expectedDate}</div>
                <div className="text-sm text-foreground/70 leading-relaxed">Deadline comes from your backend goal data.</div>
              </Card>

              <Card className="p-6 rounded-2xl bg-[#cffafe] border-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#67e8f9] flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm text-foreground/60">Remaining</div>
                </div>
                <div className="text-2xl font-bold mb-1">{moneyFormatter(Math.max(0, selectedGoal.target - selectedGoal.current))}</div>
                <div className="text-sm text-foreground/70 leading-relaxed">Remaining amount to complete this goal.</div>
              </Card>
            </div>

            <div className="mt-6 flex gap-3">
              <Button className="rounded-xl" onClick={() => setEditOpen(true)}>
                Edit Goal
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setContributionOpen(true)}>
                Add Contribution
              </Button>
              <Button
                variant="ghost"
                className="rounded-xl text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete Goal
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      <CreateGoalModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreateGoal={handleCreateGoal} />

      <EditGoalModal
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleEditGoal}
        goal={selectedGoal}
      />

      <AddContributionModal
        open={contributionOpen}
        onOpenChange={setContributionOpen}
        onAdd={handleAddContribution}
        goal={selectedGoal}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete goal?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the goal &quot;{selectedGoal?.name}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={handleDeleteGoal}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
