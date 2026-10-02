const budgetService = require('../services/budgetService');


const getSuggestions = async (req, res) => {
  const userId = req.userId;
  const { limit = 20, unreadOnly = 'false' } = req.query;

  const parsedUnreadOnly = String(unreadOnly).toLowerCase() === 'true';

  try {
    const suggestions = await budgetService.getPersistedSuggestions(userId, {
      limit: Number(limit),
      unreadOnly: parsedUnreadOnly,
    });

    return res.status(200).json({ suggestions });
  } catch (err) {
    console.error('getSuggestions error:', err.message);
    return res.status(500).json({ error: 'Server error fetching suggestions' });
  }
};

const refreshSuggestions = async (req, res) => {
  const userId = req.userId;

  let parsed;
  try {
    parsed = budgetService.parseMonthYear(
      req.body?.month ?? req.query?.month,
      req.body?.year ?? req.query?.year
    );
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  try {
    const { suggestions } = await budgetService.refreshSuggestionsForUser(
      userId,
      parsed.month,
      parsed.year
    );

    return res.status(200).json({
      month: parsed.month,
      year: parsed.year,
      suggestions,
    });
  } catch (err) {
    console.error('refreshSuggestions error:', err.message);

    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }

    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({ error: 'Server error refreshing suggestions' });
  }
};

const markSuggestionRead = async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;

  const suggestionId = Number(id);
  if (!Number.isInteger(suggestionId) || suggestionId <= 0) {
    return res.status(400).json({ error: 'Invalid suggestion id' });
  }

  try {
    const updated = await budgetService.markSuggestionRead(userId, suggestionId);

    if (!updated) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    return res.status(200).json({ message: 'Suggestion marked as read', suggestion: updated });
  } catch (err) {
    console.error('markSuggestionRead error:', err.message);
    return res.status(500).json({ error: 'Server error updating suggestion' });
  }
};

const generateSuggestions = async (req, res) => {
  return refreshSuggestions(req, res);
};

const markSuggestionReadPut = async (req, res) => {
  return markSuggestionRead(req, res);
};

module.exports = {
  getSuggestions,
  refreshSuggestions,
  markSuggestionRead,
  generateSuggestions,
  markSuggestionReadPut,
};
