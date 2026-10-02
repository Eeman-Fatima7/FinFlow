const db = require('../db/db');
const {
  createGoal: createGoalRecord,
  updateGoal: updateGoalRecord,
  ensureOwnedGoal,
} = require('../services/goals/goalWriteService');

const createGoal = async (req, res) => {
  const userId = req.userId;
  const { title, target_amount, deadline } = req.body;

  if (!title || !target_amount) {
    return res.status(400).json({ error: 'title and target_amount are required' });
  }

  try {
    const goal = await createGoalRecord({
      userId,
      title,
      targetAmount: target_amount,
      deadline,
    });

    return res.status(201).json({ message: 'Goal created', goal });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    console.error('createGoal error:', err.message);
    return res.status(500).json({ error: 'Server error creating goal' });
  }
};

const getGoals = async (req, res) => {
  const userId = req.userId;
  try {
    const result = await db.query(
      `SELECT *,
         ROUND((current_savings / NULLIF(target_amount, 0)) * 100, 1) AS progress_percentage
       FROM goals
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return res.status(200).json({ goals: result.rows });
  } catch (err) {
    console.error('getGoals error:', err.message);
    return res.status(500).json({ error: 'Server error fetching goals' });
  }
};

const updateGoal = async (req, res) => {
  const userId = req.userId;
  const { id }  = req.params;
  const { current_savings, status, title, target_amount, deadline } = req.body;

  try {
    const goal = await updateGoalRecord({
      userId,
      goalId: id,
      fields: {
        current_savings,
        status,
        title,
        target_amount,
        deadline,
      },
    });

    return res.status(200).json({ message: 'Goal updated', goal });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    console.error('updateGoal error:', err.message);
    return res.status(500).json({ error: 'Server error updating goal' });
  }
};

const deleteGoal = async (req, res) => {
  const userId = req.userId;
  const { id }  = req.params;

  try {
    await ensureOwnedGoal({ userId, goalId: id });
    await db.query('DELETE FROM goals WHERE goal_id = $1', [id]);
    return res.status(200).json({ message: 'Goal deleted' });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    console.error('deleteGoal error:', err.message);
    return res.status(500).json({ error: 'Server error deleting goal' });
  }
};

module.exports = { createGoal, getGoals, updateGoal, deleteGoal };