'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, apiRequest } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';

type HealthState = 'balanced' | 'tight' | 'deficit';

type PlanLifecycle = {
  suggested?: boolean;
  edited?: boolean;
  accepted?: boolean;
  active?: boolean;
};

type PlanQuestionnaire = {
  household_size?: number;
  dependents_count?: number;
  risk_tolerance?: 'low' | 'medium' | 'high';
  financial_priorities?: string[];
  savings_goal_mode?: 'conservative' | 'balanced' | 'aggressive';
  income_stability?: 'fixed' | 'variable' | 'seasonal';
  housing_cost?: number;
  utilities_cost?: number;
  groceries_baseline?: number;
  transport_baseline?: number;
  essential_subscriptions_or_fees?: number;
  emergency_savings_current?: number;
  primary_goal?: 'stabilize' | 'pay_debt' | 'save_more' | 'balanced';
  debt_priority_mode?: 'avalanche' | 'snowball';
};

type PlanAllocation = {
  allocation_id?: number;
  category_id: number;
  category_name: string;
  category_icon?: string | null;
  category_color?: string | null;
  allocation_amount: number;
  allocation_percent: number;
  is_debt_allocation: boolean;
};

type OnboardingPlan = {
  plan_id: number;
  status: 'draft' | 'active' | 'archived';
  monthly_income_snapshot: number;
  occupation_snapshot: string | null;
  city_snapshot: string | null;
  has_debt: boolean;
  debt_amount: number | null;
  minimum_monthly_debt_payment: number | null;
  debt_priority: 'low' | 'medium' | 'high' | null;
  debt_type: string | null;
  debt_notes: string | null;
  recommended_monthly_debt_payment: number;
  recommended_savings_amount: number;
  recommended_savings_percent: number;
  health_state?: HealthState;
  lifecycle?: PlanLifecycle;
  rationale_json: {
    flags?: string[];
    health_state?: HealthState;
    lifecycle?: PlanLifecycle;
    questionnaire?: PlanQuestionnaire;
    [key: string]: unknown;
  };
  allocations: PlanAllocation[];
  totals: {
    monthly_income: number;
    allocation_total: number;
    savings_amount: number;
    committed_total: number;
    remaining_balance: number;
  };
};

type PlanResponse = {
  plan: OnboardingPlan;
};

const FINANCIAL_PRIORITY_OPTIONS = [
  { value: 'debt_reduction', label: 'Debt reduction' },
  { value: 'emergency_fund', label: 'Emergency fund' },
  { value: 'save_more', label: 'Save more' },
  { value: 'stability', label: 'Income stability' },
] as const;

const money = (value: number) => `PKR ${Number(value || 0).toLocaleString('en-US')}`;

const parseNumberInput = (value: string) => {
  if (!value.trim()) return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Number(numeric.toFixed(2));
};

const parseIntegerInput = (value: string, fallback = 0) => {
  if (!value.trim()) return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
};

const getHealthStateUi = (state: HealthState) => {
  if (state === 'deficit') {
    return {
      label: 'Deficit',
      className: 'bg-red-100 text-red-700 border border-red-200',
    };
  }

  if (state === 'tight') {
    return {
      label: 'Tight',
      className: 'bg-amber-100 text-amber-700 border border-amber-200',
    };
  }

  return {
    label: 'Balanced',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  };
};

export default function OnboardingBudgetPlanPage() {
  const router = useRouter();
  const { loading: authLoading, isAuthenticated, refreshOnboarding } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [plan, setPlan] = useState<OnboardingPlan | null>(null);

  const [monthlyIncome, setMonthlyIncome] = useState('0');
  const [occupation, setOccupation] = useState('');
  const [city, setCity] = useState('');

  const [householdSize, setHouseholdSize] = useState('1');
  const [dependentsCount, setDependentsCount] = useState('0');
  const [incomeStability, setIncomeStability] = useState<'fixed' | 'variable' | 'seasonal'>('fixed');
  const [primaryGoal, setPrimaryGoal] = useState<'stabilize' | 'pay_debt' | 'save_more' | 'balanced'>('balanced');
  const [riskTolerance, setRiskTolerance] = useState<'low' | 'medium' | 'high'>('medium');
  const [savingsGoalMode, setSavingsGoalMode] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [financialPriorities, setFinancialPriorities] = useState<string[]>([]);

  const [housingCost, setHousingCost] = useState('0');
  const [utilitiesCost, setUtilitiesCost] = useState('0');
  const [groceriesBaseline, setGroceriesBaseline] = useState('0');
  const [transportBaseline, setTransportBaseline] = useState('0');
  const [essentialSubscriptionsOrFees, setEssentialSubscriptionsOrFees] = useState('0');
  const [emergencySavingsCurrent, setEmergencySavingsCurrent] = useState('0');

  const [hasDebt, setHasDebt] = useState(false);
  const [debtAmount, setDebtAmount] = useState('0');
  const [minimumDebtPayment, setMinimumDebtPayment] = useState('0');
  const [debtPriority, setDebtPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [debtPriorityMode, setDebtPriorityMode] = useState<'avalanche' | 'snowball'>('avalanche');
  const [debtType, setDebtType] = useState('');
  const [debtNotes, setDebtNotes] = useState('');

  const [savingsAmount, setSavingsAmount] = useState('0');
  const [allocations, setAllocations] = useState<PlanAllocation[]>([]);

  const hydrateFromPlan = (nextPlan: OnboardingPlan) => {
    setPlan(nextPlan);
    setMonthlyIncome(String(nextPlan.monthly_income_snapshot ?? 0));
    setOccupation(nextPlan.occupation_snapshot || '');
    setCity(nextPlan.city_snapshot || '');

    const questionnaire = (nextPlan.rationale_json?.questionnaire || {}) as PlanQuestionnaire;

    setHouseholdSize(String(questionnaire.household_size ?? 1));
    setDependentsCount(String(questionnaire.dependents_count ?? 0));
    setIncomeStability(questionnaire.income_stability || 'fixed');
    setPrimaryGoal(questionnaire.primary_goal || 'balanced');
    setRiskTolerance(questionnaire.risk_tolerance || 'medium');
    setSavingsGoalMode(questionnaire.savings_goal_mode || 'balanced');
    setFinancialPriorities(
      Array.isArray(questionnaire.financial_priorities)
        ? questionnaire.financial_priorities
        : []
    );

    setHousingCost(String(questionnaire.housing_cost ?? 0));
    setUtilitiesCost(String(questionnaire.utilities_cost ?? 0));
    setGroceriesBaseline(String(questionnaire.groceries_baseline ?? 0));
    setTransportBaseline(String(questionnaire.transport_baseline ?? 0));
    setEssentialSubscriptionsOrFees(String(questionnaire.essential_subscriptions_or_fees ?? 0));
    setEmergencySavingsCurrent(String(questionnaire.emergency_savings_current ?? 0));

    setHasDebt(Boolean(nextPlan.has_debt));
    setDebtAmount(String(nextPlan.debt_amount ?? 0));
    setMinimumDebtPayment(String(nextPlan.minimum_monthly_debt_payment ?? 0));
    setDebtPriority((nextPlan.debt_priority as 'low' | 'medium' | 'high' | null) || 'medium');
    setDebtPriorityMode(questionnaire.debt_priority_mode || 'avalanche');
    setDebtType(nextPlan.debt_type || '');
    setDebtNotes(nextPlan.debt_notes || '');

    setSavingsAmount(String(nextPlan.recommended_savings_amount ?? 0));
    setAllocations(nextPlan.allocations || []);
  };

  const loadPlan = useCallback(async () => {
    const data = await apiRequest<PlanResponse>('/onboarding/budget-plan', {
      method: 'GET',
      auth: true,
    });
    hydrateFromPlan(data.plan);
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (authLoading || !isAuthenticated) return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        await loadPlan();
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load onboarding budget plan');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, loadPlan, router]);

  const computedTotals = useMemo(() => {
    const income = parseNumberInput(monthlyIncome);
    const allocationTotal = allocations.reduce((sum, item) => sum + Number(item.allocation_amount || 0), 0);
    const savings = parseNumberInput(savingsAmount);
    const committed = Number((allocationTotal + savings).toFixed(2));
    const remaining = Number((income - committed).toFixed(2));

    return {
      income,
      allocationTotal: Number(allocationTotal.toFixed(2)),
      savings,
      committed,
      remaining,
    };
  }, [monthlyIncome, allocations, savingsAmount]);

  const liveHealthState = useMemo<HealthState>(() => {
    if (computedTotals.remaining < 0) return 'deficit';

    if (computedTotals.income <= 0) return 'tight';

    const affordabilityRatio = computedTotals.remaining / computedTotals.income;
    if (affordabilityRatio < 0.2) return 'tight';

    return 'balanced';
  }, [computedTotals]);

  const effectiveHealthState = useMemo<HealthState>(() => {
    if (!plan) return liveHealthState;
    return liveHealthState || plan.health_state || plan.rationale_json?.health_state || 'balanced';
  }, [liveHealthState, plan]);

  const lifecycle = useMemo<PlanLifecycle>(() => {
    if (!plan) return {};
    return plan.lifecycle || plan.rationale_json?.lifecycle || {};
  }, [plan]);

  const debtFloorViolation = hasDebt && parseNumberInput(minimumDebtPayment) <= 0;
  const acceptBlocked = computedTotals.remaining < 0 || debtFloorViolation;

  const setAllocationValue = (categoryId: number, rawValue: string) => {
    const amount = parseNumberInput(rawValue);

    setAllocations((prev) =>
      prev.map((allocation) => {
        if (allocation.category_id !== categoryId) return allocation;
        const percent = computedTotals.income > 0
          ? Number(((amount / computedTotals.income) * 100).toFixed(3))
          : 0;

        return {
          ...allocation,
          allocation_amount: amount,
          allocation_percent: percent,
        };
      })
    );
  };

  const togglePriority = (value: string, checked: boolean | 'indeterminate') => {
    if (checked) {
      setFinancialPriorities((prev) => Array.from(new Set([...prev, value])));
      return;
    }

    setFinancialPriorities((prev) => prev.filter((item) => item !== value));
  };

  const buildQuestionnairePayload = () => ({
    household_size: parseIntegerInput(householdSize, 1),
    dependents_count: parseIntegerInput(dependentsCount, 0),
    risk_tolerance: riskTolerance,
    financial_priorities: financialPriorities,
    savings_goal_mode: savingsGoalMode,
    income_stability: incomeStability,
    housing_cost: parseNumberInput(housingCost),
    utilities_cost: parseNumberInput(utilitiesCost),
    groceries_baseline: parseNumberInput(groceriesBaseline),
    transport_baseline: parseNumberInput(transportBaseline),
    essential_subscriptions_or_fees: parseNumberInput(essentialSubscriptionsOrFees),
    emergency_savings_current: parseNumberInput(emergencySavingsCurrent),
    primary_goal: primaryGoal,
    debt_priority_mode: hasDebt ? debtPriorityMode : 'avalanche',
  });

  const handlePreviewRegenerate = async () => {
    setSaving(true);
    setSuccess(null);
    setError(null);

    try {
      const payload = {
        monthly_income: parseNumberInput(monthlyIncome),
        occupation,
        city,
        has_debt: hasDebt,
        debt_amount: hasDebt ? parseNumberInput(debtAmount) : null,
        minimum_monthly_debt_payment: hasDebt ? parseNumberInput(minimumDebtPayment) : null,
        debt_priority: hasDebt ? debtPriority : null,
        debt_priority_mode: hasDebt ? debtPriorityMode : 'avalanche',
        debt_type: hasDebt ? debtType : null,
        debt_notes: hasDebt ? debtNotes : null,
        ...buildQuestionnairePayload(),
      };

      const response = await apiRequest<PlanResponse>('/onboarding/budget-plan/preview', {
        method: 'POST',
        auth: true,
        body: JSON.stringify(payload),
      });

      hydrateFromPlan(response.plan);
      setSuccess('Suggested plan regenerated.');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to regenerate suggestion');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdits = async () => {
    setSaving(true);
    setSuccess(null);
    setError(null);

    try {
      const payload = {
        source: 'user_edit',
        monthly_income: parseNumberInput(monthlyIncome),
        occupation,
        city,
        has_debt: hasDebt,
        debt_amount: hasDebt ? parseNumberInput(debtAmount) : null,
        minimum_monthly_debt_payment: hasDebt ? parseNumberInput(minimumDebtPayment) : null,
        debt_priority: hasDebt ? debtPriority : null,
        debt_priority_mode: hasDebt ? debtPriorityMode : 'avalanche',
        debt_type: hasDebt ? debtType : null,
        debt_notes: hasDebt ? debtNotes : null,
        ...buildQuestionnairePayload(),
        recommended_savings_amount: parseNumberInput(savingsAmount),
        recommended_monthly_debt_payment: hasDebt
          ? allocations.find((item) => item.is_debt_allocation)?.allocation_amount || 0
          : 0,
        allocations: allocations.map((allocation) => ({
          category_id: allocation.category_id,
          allocation_amount: Number(allocation.allocation_amount || 0),
          is_debt_allocation: allocation.is_debt_allocation,
        })),
      };

      const response = await apiRequest<PlanResponse & { message: string }>('/onboarding/budget-plan', {
        method: 'PUT',
        auth: true,
        body: JSON.stringify(payload),
      });

      hydrateFromPlan(response.plan);
      setSuccess(response.message || 'Plan saved successfully');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to save onboarding plan');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptPlan = async () => {
    setAccepting(true);
    setSuccess(null);
    setError(null);

    try {
      await apiRequest('/onboarding/budget-plan/accept', {
        method: 'POST',
        auth: true,
      });

      await refreshOnboarding();
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to accept onboarding plan');
      }
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-zinc-500">Loading onboarding budget plan...</div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Budget onboarding not available</CardTitle>
            <CardDescription>{error || 'No draft budget plan found for your account.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.replace('/dashboard')}>Go to dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const healthStateUi = getHealthStateUi(effectiveHealthState);

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Suggested monthly budget plan</CardTitle>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${healthStateUi.className}`}>
                {healthStateUi.label}
              </span>
            </div>
            <CardDescription>
              Review the suggested allocations, adjust anything you want, then accept to activate your budget.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="monthly-income">Monthly income (PKR)</Label>
                <Input
                  id="monthly-income"
                  type="number"
                  min={0}
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="occupation">Occupation</Label>
                <Input
                  id="occupation"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border bg-zinc-100 px-2 py-1">
                Suggested: {lifecycle.suggested ? 'Yes' : 'No'}
              </span>
              <span className="rounded-full border bg-zinc-100 px-2 py-1">
                Edited: {lifecycle.edited ? 'Yes' : 'No'}
              </span>
              <span className="rounded-full border bg-zinc-100 px-2 py-1">
                Accepted: {lifecycle.accepted ? 'Yes' : 'No'}
              </span>
              <span className="rounded-full border bg-zinc-100 px-2 py-1">
                Active: {lifecycle.active ? 'Yes' : 'No'}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Need a refreshed recommendation?</p>
                <p className="text-xs text-zinc-500">Regenerate based on updated profile, questionnaire, and debt inputs.</p>
              </div>
              <Button variant="outline" onClick={handlePreviewRegenerate} disabled={saving || accepting}>
                {saving ? 'Regenerating...' : 'Regenerate suggestion'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Questionnaire inputs</CardTitle>
            <CardDescription>These inputs shape your guided zero-based budget recommendation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="household-size">Household size</Label>
                <Input
                  id="household-size"
                  type="number"
                  min={1}
                  value={householdSize}
                  onChange={(e) => setHouseholdSize(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dependents-count">Dependents count</Label>
                <Input
                  id="dependents-count"
                  type="number"
                  min={0}
                  value={dependentsCount}
                  onChange={(e) => setDependentsCount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="income-stability">Income stability</Label>
                <select
                  id="income-stability"
                  className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"
                  value={incomeStability}
                  onChange={(e) => setIncomeStability(e.target.value as 'fixed' | 'variable' | 'seasonal')}
                >
                  <option value="fixed">Fixed</option>
                  <option value="variable">Variable</option>
                  <option value="seasonal">Seasonal</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="primary-goal">Primary goal</Label>
                <select
                  id="primary-goal"
                  className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"
                  value={primaryGoal}
                  onChange={(e) => setPrimaryGoal(e.target.value as 'stabilize' | 'pay_debt' | 'save_more' | 'balanced')}
                >
                  <option value="stabilize">Stabilize</option>
                  <option value="pay_debt">Pay debt</option>
                  <option value="save_more">Save more</option>
                  <option value="balanced">Balanced</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="risk-tolerance">Risk tolerance</Label>
                <select
                  id="risk-tolerance"
                  className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"
                  value={riskTolerance}
                  onChange={(e) => setRiskTolerance(e.target.value as 'low' | 'medium' | 'high')}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="savings-goal-mode">Savings mode</Label>
                <select
                  id="savings-goal-mode"
                  className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"
                  value={savingsGoalMode}
                  onChange={(e) => setSavingsGoalMode(e.target.value as 'conservative' | 'balanced' | 'aggressive')}
                >
                  <option value="conservative">Conservative</option>
                  <option value="balanced">Balanced</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Financial priorities</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {FINANCIAL_PRIORITY_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                    <Checkbox
                      checked={financialPriorities.includes(option.value)}
                      onCheckedChange={(checked) => togglePriority(option.value, checked)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="housing-cost">Housing cost (PKR)</Label>
                <Input
                  id="housing-cost"
                  type="number"
                  min={0}
                  value={housingCost}
                  onChange={(e) => setHousingCost(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="utilities-cost">Utilities cost (PKR)</Label>
                <Input
                  id="utilities-cost"
                  type="number"
                  min={0}
                  value={utilitiesCost}
                  onChange={(e) => setUtilitiesCost(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="groceries-baseline">Groceries baseline (PKR)</Label>
                <Input
                  id="groceries-baseline"
                  type="number"
                  min={0}
                  value={groceriesBaseline}
                  onChange={(e) => setGroceriesBaseline(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transport-baseline">Transport baseline (PKR)</Label>
                <Input
                  id="transport-baseline"
                  type="number"
                  min={0}
                  value={transportBaseline}
                  onChange={(e) => setTransportBaseline(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="essential-subscriptions">Essential subscriptions/fees (PKR)</Label>
                <Input
                  id="essential-subscriptions"
                  type="number"
                  min={0}
                  value={essentialSubscriptionsOrFees}
                  onChange={(e) => setEssentialSubscriptionsOrFees(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergency-savings-current">Current emergency savings (PKR)</Label>
                <Input
                  id="emergency-savings-current"
                  type="number"
                  min={0}
                  value={emergencySavingsCurrent}
                  onChange={(e) => setEmergencySavingsCurrent(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debt planning</CardTitle>
            <CardDescription>Debt repayment is first-class and included in your monthly allocation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="has-debt"
                checked={hasDebt}
                onCheckedChange={(checked) => setHasDebt(Boolean(checked))}
              />
              <Label htmlFor="has-debt">I currently have debt to repay</Label>
            </div>

            {hasDebt ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="debt-amount">Total debt amount (PKR)</Label>
                  <Input
                    id="debt-amount"
                    type="number"
                    min={0}
                    value={debtAmount}
                    onChange={(e) => setDebtAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minimum-payment">Minimum monthly debt payment (PKR)</Label>
                  <Input
                    id="minimum-payment"
                    type="number"
                    min={0}
                    value={minimumDebtPayment}
                    onChange={(e) => setMinimumDebtPayment(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="debt-priority">Debt priority</Label>
                  <select
                    id="debt-priority"
                    className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"
                    value={debtPriority}
                    onChange={(e) => setDebtPriority(e.target.value as 'low' | 'medium' | 'high')}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="debt-priority-mode">Debt payoff mode</Label>
                  <select
                    id="debt-priority-mode"
                    className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm"
                    value={debtPriorityMode}
                    onChange={(e) => setDebtPriorityMode(e.target.value as 'avalanche' | 'snowball')}
                  >
                    <option value="avalanche">Avalanche</option>
                    <option value="snowball">Snowball</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="debt-type">Debt type (optional)</Label>
                  <Input
                    id="debt-type"
                    value={debtType}
                    onChange={(e) => setDebtType(e.target.value)}
                    placeholder="e.g. credit card, student loan"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="debt-notes">Debt notes (optional)</Label>
                  <Textarea
                    id="debt-notes"
                    value={debtNotes}
                    onChange={(e) => setDebtNotes(e.target.value)}
                    placeholder="Any context that affects your repayment plan"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Debt repayment allocation will be set to zero.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allocations editor</CardTitle>
            <CardDescription>Edit each category amount before activation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="savings-amount">Recommended savings amount (PKR)</Label>
              <Input
                id="savings-amount"
                type="number"
                min={0}
                value={savingsAmount}
                onChange={(e) => setSavingsAmount(e.target.value)}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {allocations.map((allocation) => (
                <div key={allocation.category_id} className="rounded-lg border bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{allocation.category_name}</span>
                    <span className="text-xs text-zinc-500">{allocation.allocation_percent.toFixed(2)}%</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={allocation.allocation_amount}
                    onChange={(e) => setAllocationValue(allocation.category_id, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Validation summary</CardTitle>
            <CardDescription>Totals must stay within your monthly income.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Plan health</span>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${healthStateUi.className}`}>
                {healthStateUi.label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Monthly income</span>
              <span className="font-medium">{money(computedTotals.income)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Category allocations total</span>
              <span className="font-medium">{money(computedTotals.allocationTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Savings</span>
              <span className="font-medium">{money(computedTotals.savings)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span>Total committed</span>
              <span className="font-semibold">{money(computedTotals.committed)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Remaining balance</span>
              <span className={computedTotals.remaining < 0 ? 'font-semibold text-red-600' : 'font-semibold text-emerald-600'}>
                {money(computedTotals.remaining)}
              </span>
            </div>

            {debtFloorViolation && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                Minimum monthly debt payment must be greater than zero when debt is enabled.
              </p>
            )}

            {computedTotals.remaining < 0 && (
              <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                Your plan is over-allocated. Reduce allocations or savings before accepting.
              </p>
            )}

            {Array.isArray(plan.rationale_json?.flags) && plan.rationale_json.flags.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-600">
                {plan.rationale_json.flags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button variant="outline" onClick={handleSaveEdits} disabled={saving || accepting}>
            {saving ? 'Saving...' : 'Save edits'}
          </Button>
          <Button
            onClick={handleAcceptPlan}
            disabled={accepting || saving || acceptBlocked}
          >
            {accepting ? 'Accepting...' : 'Accept and continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
