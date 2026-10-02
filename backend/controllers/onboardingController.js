const {
  getOnboardingStatus,
  getCurrentPlanForUser,
  mapPlanResponse,
  previewDraftPlan,
  updateDraftPlan,
  acceptDraftPlan,
} = require('../services/budgets/planWriteService');

const getStatus = async (req, res) => {
  try {
    const status = await getOnboardingStatus({ userId: req.userId });
    return res.status(200).json(status);
  } catch (err) {
    console.error('getStatus error:', err.message);
    return res.status(500).json({ error: 'Server error fetching onboarding status' });
  }
};

const getBudgetPlan = async (req, res) => {
  try {
    const planHeader = await getCurrentPlanForUser({ userId: req.userId });

    if (!planHeader) {
      return res.status(404).json({ error: 'No onboarding budget plan found' });
    }

    const plan = await mapPlanResponse({ planHeader });
    return res.status(200).json({ plan });
  } catch (err) {
    console.error('getBudgetPlan error:', err.message);
    return res.status(500).json({ error: 'Server error fetching onboarding budget plan' });
  }
};

const previewBudgetPlan = async (req, res) => {
  try {
    const plan = await previewDraftPlan({
      userId: req.userId,
      payload: req.body || {},
    });

    return res.status(200).json({ plan });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    console.error('previewBudgetPlan error:', err.message);
    return res.status(500).json({ error: 'Server error generating onboarding budget preview' });
  }
};

const updateBudgetPlan = async (req, res) => {
  try {
    const plan = await updateDraftPlan({
      userId: req.userId,
      payload: req.body || {},
    });

    return res.status(200).json({
      message: 'Onboarding budget plan updated',
      plan,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    console.error('updateBudgetPlan error:', err.message);
    return res.status(500).json({ error: 'Server error updating onboarding budget plan' });
  }
};

const acceptBudgetPlan = async (req, res) => {
  try {
    const result = await acceptDraftPlan({
      userId: req.userId,
      month: req.body?.month,
      year: req.body?.year,
    });

    return res.status(200).json({
      message: 'Onboarding budget plan accepted',
      ...result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    console.error('acceptBudgetPlan error:', err.message);
    return res.status(500).json({ error: 'Server error accepting onboarding budget plan' });
  }
};

module.exports = {
  getStatus,
  getBudgetPlan,
  previewBudgetPlan,
  updateBudgetPlan,
  acceptBudgetPlan,
};
