import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Target,
  Plane,
  GraduationCap,
  Car,
  Calendar,
  DollarSign,
  TrendingUp
} from "lucide-react";
import { motion } from "motion/react";
import { useState, useRef } from "react";
import { CreateGoalModal, type NewGoal } from "@/components/create-goal-modal";
import { EditGoalModal } from "@/components/edit-goal-modal";
import type { LucideIcon } from "lucide-react";
import { AddContributionModal } from "@/components/add-contribution-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type Goal = {
  id: number;
  name: string;
  icon: LucideIcon;
  color: string;
  lightColor: string;
  current: number;
  target: number;
  monthlyContribution: number;
  expectedDate: string;
  category: string;
};

const initialGoals: Goal[] = [
  {
    id: 1,
    name: "Emergency Fund",
    icon: Target,
    color: "#93c5fd",
    lightColor: "#dbeafe",
    current: 5155,
    target: 8000,
    monthlyContribution: 450,
    expectedDate: "Mar 2027",
    category: "savings"
  },
  {
    id: 2,
    name: "European Vacation",
    icon: Plane,
    color: "#f9a8d4",
    lightColor: "#fce7f3",
    current: 2400,
    target: 6000,
    monthlyContribution: 300,
    expectedDate: "Aug 2026",
    category: "travel"
  },
  {
    id: 3,
    name: "New Car Down Payment",
    icon: Car,
    color: "#67e8f9",
    lightColor: "#cffafe",
    current: 4200,
    target: 15000,
    monthlyContribution: 600,
    expectedDate: "Dec 2027",
    category: "purchase"
  },
  {
    id: 4,
    name: "Master's Degree",
    icon: GraduationCap,
    color: "#c084fc",
    lightColor: "#f3e8ff",
    current: 8500,
    target: 25000,
    monthlyContribution: 500,
    expectedDate: "Sep 2028",
    category: "education"
  },
];

export function Goals() {
  const [goals, setGoals] = useState(initialGoals);
  const [selectedGoalId, setSelectedGoalId] = useState(goals[0].id);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [contributionOpen, setContributionOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const newGoalRef = useRef<HTMLDivElement>(null);

  // Derive selectedGoal from goals array
  const selectedGoal = goals.find(g => g.id === selectedGoalId) || goals[0];

  const totalSaved = goals.reduce((sum, goal) => sum + goal.current, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.target, 0);
  const overallProgress = (totalSaved / totalTarget) * 100;

  const handleCreateGoal = (newGoalData: NewGoal) => {
    const newGoal = {
      id: Math.max(...goals.map(g => g.id), 0) + 1,
      name: newGoalData.name,
      icon: newGoalData.icon,
      color: newGoalData.color,
      lightColor: newGoalData.lightColor,
      current: newGoalData.startingAmount,
      target: newGoalData.target,
      monthlyContribution: newGoalData.monthlyContribution,
      expectedDate: newGoalData.targetDate,
      category: "custom"
    };

    setGoals(prev => [...prev, newGoal]);
    setIsCreateModalOpen(false);
    toast.success('Goal created successfully! 🎉');

    // Scroll to new goal after a short delay
    setTimeout(() => {
      newGoalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleEditGoal = (updatedFields: { name: string; target: number; expectedDate: string }) => {
    setGoals(prev => prev.map(goal => 
      goal.id === selectedGoalId
        ? { ...goal, ...updatedFields }
        : goal
    ));
    toast.success('Goal updated successfully');
  };

  const handleAddContribution = (contribution: { amount: number; date: string; note?: string }) => {
    if (contribution.amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    setGoals(prev => prev.map(goal => 
      goal.id === selectedGoalId
        ? { 
            ...goal, 
            current: Math.min(goal.target, goal.current + contribution.amount)
          }
        : goal
    ));
    
    toast.success('Contribution added successfully! 💰');
  };

  const handleDeleteGoal = () => {
    const filteredGoals = goals.filter(g => g.id !== selectedGoalId);
    
    if (filteredGoals.length === 0) {
      toast.error('You must have at least one goal');
      setDeleteOpen(false);
      return;
    }

    setGoals(filteredGoals);
    setSelectedGoalId(filteredGoals[0].id);
    setDeleteOpen(false);
    toast.success('Goal deleted');
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
          <h2 className="text-2xl font-bold mb-1">Savings Goals</h2>
          <p className="text-sm text-foreground/60">Track your progress toward your financial dreams</p>
        </div>
        
        <Button 
          className="rounded-xl bg-primary hover:bg-primary/90"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Goal
        </Button>
      </motion.div>

      {/* Overview card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-8 rounded-3xl border-2 bg-gradient-to-br from-[#dcfce7] via-[#cffafe] to-[#dbeafe]">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="text-sm text-foreground/60 mb-2">Total Saved</div>
              <div className="text-4xl font-bold mb-1">${totalSaved.toLocaleString()}</div>
              <div className="text-sm text-foreground/60">of ${totalTarget.toLocaleString()} goal</div>
            </div>
            <div>
              <div className="text-sm text-foreground/60 mb-2">Overall Progress</div>
              <div className="text-4xl font-bold mb-3">{overallProgress.toFixed(0)}%</div>
              <div className="w-full bg-white rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#86efac] via-[#67e8f9] to-[#93c5fd] rounded-full transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
            <div>
              <div className="text-sm text-foreground/60 mb-2">Monthly Contribution</div>
              <div className="text-4xl font-bold mb-1">
                ${goals.reduce((sum, g) => sum + g.monthlyContribution, 0)}
              </div>
              <div className="text-sm text-foreground/60">across {goals.length} goals</div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Goals grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {goals.map((goal, index) => {
          const progress = (goal.current / goal.target) * 100;
          const remaining = goal.target - goal.current;
          const Icon = goal.icon;
          const isNewGoal = index === goals.length - 1 && goals.length > initialGoals.length;

          return (
            <motion.div
              key={goal.id}
              ref={isNewGoal ? newGoalRef : null}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
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
                        <div className="text-3xl font-bold">${goal.current.toLocaleString()}</div>
                        <div className="text-sm text-foreground/60">of ${goal.target.toLocaleString()}</div>
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
                        style={{ 
                          width: `${Math.min(progress, 100)}%`,
                          backgroundColor: goal.color
                        }}
                      />
                    </div>
                  </div>

                  <div 
                    className="p-4 rounded-2xl"
                    style={{ backgroundColor: goal.lightColor }}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-foreground/60 mb-1">Remaining</div>
                        <div className="text-lg font-bold">${remaining.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-foreground/60 mb-1">Monthly</div>
                        <div className="text-lg font-bold">${goal.monthlyContribution}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Goal detail section */}
      {selectedGoal && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-8 rounded-3xl border-2">
            <h3 className="text-xl font-bold mb-6">Goal Insights: {selectedGoal.name}</h3>
            
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="p-6 rounded-2xl bg-[#dcfce7] border-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#86efac] flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm text-foreground/60">On Track</div>
                </div>
                <div className="text-2xl font-bold mb-1">Great Progress!</div>
                <div className="text-sm text-foreground/70 leading-relaxed">
                  You're {((selectedGoal.current / selectedGoal.target) * 100).toFixed(0)}% toward your goal. 
                  Keep up the monthly contributions.
                </div>
              </Card>

              <Card className="p-6 rounded-2xl bg-[#f3e8ff] border-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#c084fc] flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm text-foreground/60">Timeline</div>
                </div>
                <div className="text-2xl font-bold mb-1">{selectedGoal.expectedDate}</div>
                <div className="text-sm text-foreground/70 leading-relaxed">
                  Expected completion at current savings rate. You can reach it {Math.ceil((selectedGoal.target - selectedGoal.current) / selectedGoal.monthlyContribution)} months earlier with +$100/month.
                </div>
              </Card>

              <Card className="p-6 rounded-2xl bg-[#cffafe] border-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#67e8f9] flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm text-foreground/60">Tip</div>
                </div>
                <div className="text-2xl font-bold mb-1">Save More</div>
                <div className="text-sm text-foreground/70 leading-relaxed">
                  Consider increasing your contribution by $50-100/month. 
                  Small increases compound significantly over time.
                </div>
              </Card>
            </div>

            <div className="mt-6 flex gap-3">
              <Button className="rounded-xl" onClick={() => setEditOpen(true)}>Edit Goal</Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setContributionOpen(true)}>Add Contribution</Button>
              <Button variant="ghost" className="rounded-xl text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                Delete Goal
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Motivational section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="p-8 rounded-3xl border-2 bg-gradient-to-br from-primary to-primary/90 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2">You're doing amazing! 🎉</h3>
              <p className="text-white/80 leading-relaxed">
                You've saved ${totalSaved.toLocaleString()} toward your goals. 
                That's {overallProgress.toFixed(0)}% of your total target. 
                Every contribution brings you closer to your dreams.
              </p>
            </div>
            <Button size="lg" variant="secondary" className="rounded-xl px-8">
              View Tips
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Create Goal Modal */}
      <CreateGoalModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateGoal={handleCreateGoal}
      />

      {/* Edit Goal Modal */}
      <EditGoalModal
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleEditGoal}
        goal={selectedGoal}
      />

      {/* Add Contribution Modal */}
      <AddContributionModal
        open={contributionOpen}
        onOpenChange={setContributionOpen}
        onAdd={handleAddContribution}
        goal={selectedGoal}
      />

      {/* Delete Goal Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete goal?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the goal "{selectedGoal?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={handleDeleteGoal}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}