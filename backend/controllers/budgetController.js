const db = require('../db/db');
const { upsertBudget, parseMonthYear } = require('../services/budgets/budgetWriteService');
const { getActivePlanForUser, mapPlanResponse } = require('../services/budgets/planWriteService');

// ─── SET BUDGET ───────────────────────────────────────────────
const setBudget = async (req, res) => {
  const userId = req.userId;
  const { category_id, monthly_limit, month, year } = req.body;

  if (!category_id || !monthly_limit) {
    return res.status(400).json({ error: 'category_id and monthly_limit are required' });
  }

  try {
    const { budget } = await upsertBudget({
      userId,
      categoryId: category_id,
      monthlyLimit: monthly_limit,
      month,
      year,
    });

    return res.status(201).json({ message: 'Budget set', budget });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    console.error('setBudget error:', err.message);
    return res.status(500).json({ error: 'Server error setting budget' });
  }
};

// ─── GET BUDGETS ──────────────────────────────────────────────
const getBudgets = async (req, res) => {
  const userId = req.userId;

  let month;
  let year;

  try {
    ({ month, year } = parseMonthYear(req.query.month, req.query.year));
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  try {
    const spendResult = await db.query(
      `SELECT
         c.category_id,
         c.name AS category_name,
         c.icon AS category_icon,
         c.color AS category_color,
         COALESCE(SUM(t.amount), 0) AS spent
       FROM categories c
       LEFT JOIN transactions t
         ON t.user_id = $1
        AND t.category_id = c.category_id
        AND t.type = 'expense'
        AND EXTRACT(MONTH FROM t.date) = $2
        AND EXTRACT(YEAR FROM t.date) = $3
       WHERE c.type = 'expense'
       GROUP BY c.category_id, c.name, c.icon, c.color`,
      [userId, month, year]
    );

    const spendByCategoryId = new Map();
    spendResult.rows.forEach((row) => {
      spendByCategoryId.set(Number(row.category_id), {
        category_name: row.category_name,
        category_icon: row.category_icon,
        category_color: row.category_color,
        spent: Number(row.spent || 0),
      });
    });

    const result = await db.query(
      `SELECT
         b.*,
         c.name  AS category_name,
         c.icon  AS category_icon,
         c.color AS category_color
       FROM budgets b
       JOIN categories c ON b.category_id = c.category_id
       WHERE b.user_id = $1
         AND b.month = $2
         AND b.year  = $3
       ORDER BY c.name`,
      [userId, month, year]
    );

    const explicitBudgets = result.rows.map((b) => {
      const spend = Number(spendByCategoryId.get(Number(b.category_id))?.spent || 0);
      const limit = Number(b.monthly_limit || 0);

      return {
        ...b,
        spent: spend,
        remaining: limit - spend,
        percentage: limit > 0 ? Math.round((spend / limit) * 100) : 0,
        source: 'budget_table',
      };
    });

    if (explicitBudgets.length > 0) {
      return res.status(200).json({ budgets: explicitBudgets });
    }

    const activePlanHeader = await getActivePlanForUser({ userId });
    if (!activePlanHeader) {
      return res.status(200).json({ budgets: [] });
    }

    const activePlan = await mapPlanResponse({ planHeader: activePlanHeader });

    const syntheticBudgets = (activePlan.allocations || [])
      .filter((allocation) => Number(allocation.allocation_amount || 0) > 0)
      .map((allocation) => {
        const spend = Number(spendByCategoryId.get(Number(allocation.category_id))?.spent || 0);
        const monthlyLimit = Number(allocation.allocation_amount || 0);

        return {
          budget_id: null,
          user_id: userId,
          category_id: allocation.category_id,
          monthly_limit: monthlyLimit,
          month,
          year,
          category_name: allocation.category_name,
          category_icon: allocation.category_icon || null,
          category_color: allocation.category_color || null,
          spent: spend,
          remaining: Number((monthlyLimit - spend).toFixed(2)),
          percentage: monthlyLimit > 0 ? Math.round((spend / monthlyLimit) * 100) : 0,
          source: 'active_plan_runtime',
          plan_id: activePlan.plan_id,
        };
      })
      .sort((a, b) => String(a.category_name || '').localeCompare(String(b.category_name || '')));

    return res.status(200).json({ budgets: syntheticBudgets });
  } catch (err) {
    console.error('getBudgets error:', err.message);
    return res.status(500).json({ error: 'Server error fetching budgets' });
  }
};

module.exports = { setBudget, getBudgets };