const advisorService = require('../services/advisorService');
const budgetService = require('../services/budgetService');
const db = require('../db/db');
const {
  parseAssistantOutput,
  persistActionProposal,
} = require('../services/ai/actionProposalService');
const {
  executeConfirmedAction,
} = require('../services/ai/actionExecutionService');
const { logServiceEvent, getRequestCorrelationId, makeCorrelationId } = require('../services/observability/eventLogger');

const parseInputText = (value, fieldName) => {
  const text = typeof value === 'string' ? value.trim() : '';

  if (!text) {
    const err = new Error(`${fieldName} is required`);
    err.statusCode = 400;
    throw err;
  }

  return text;
};

const handleAiError = (res, err, fallbackMessage) => {
  console.error(`${fallbackMessage}:`, err.message);

  if (err.statusCode === 400) {
    return res.status(400).json({ error: err.message });
  }

  if (err.statusCode === 404) {
    return res.status(404).json({ error: err.message });
  }

  if (err.statusCode === 409) {
    return res.status(409).json({ error: err.message });
  }

  if (err.statusCode === 410) {
    return res.status(410).json({ error: err.message });
  }

  if (err.statusCode === 503) {
    return res.status(503).json({ error: err.message });
  }

  return res.status(500).json({ error: fallbackMessage });
};

const buildEmptyStructuredContext = () => ({
  confirmed: [],
  predicted: [],
  uncertain: [],
  meta: {
    generated_at: new Date().toISOString(),
    confirmed_count: 0,
    predicted_count: 0,
    uncertain_count: 0,
    quality_flags: [],
    sources: {
      anomaly_summary_available: false,
      forecast_available: false,
      forecast_history_available: false,
      latest_import_session_id: null,
    },
  },
});

const generateAiReply = async ({ userId, inputText, month, year, channel, correlationId }) => {
  const startedAt = Date.now();

  try {
    const { analysis } = await budgetService.refreshSuggestionsForUser(userId, month, year);

    const summary = await advisorService.getUserSummary(userId, month, year, analysis, {
      correlationId,
    });
    const prompts = advisorService.buildPrompt(summary, inputText);
    const rawReply = await advisorService.callLLM(prompts, {
      correlationId,
      userId,
      channel,
    });

    const parsedOutput = parseAssistantOutput(rawReply);
    const cleanedReply = typeof parsedOutput.reply_text === 'string'
      ? parsedOutput.reply_text.trim()
      : '';

    if (!cleanedReply) {
      const err = new Error('LLM service unavailable: empty response');
      err.statusCode = 503;
      throw err;
    }

    const aiLog = await advisorService.logInteraction(userId, inputText, cleanedReply, channel);

    let persistedProposal = null;
    let proposalError = parsedOutput.proposal_error || null;

    if (parsedOutput.proposal) {
      try {
        persistedProposal = await persistActionProposal({
          userId,
          aiLogId: aiLog.log_id,
          proposal: parsedOutput.proposal,
          correlationId,
          expiresInMinutes: 30,
        });
      } catch (err) {
        proposalError = err.message || 'Failed to persist action proposal';
      }
    }

    const structuredContext = summary.structured_context || buildEmptyStructuredContext();

    if (proposalError) {
      logServiceEvent({
        service: 'ai.controller',
        operation: channel === 'voice' ? 'handle_voice' : 'handle_query',
        status: 'degraded',
        userId,
        latencyMs: Date.now() - startedAt,
        fallbackUsed: true,
        requestLike: { correlationId },
        details: {
          month,
          year,
          channel,
          proposal_error: proposalError,
        },
      });
    }

    logServiceEvent({
      service: 'ai.controller',
      operation: channel === 'voice' ? 'handle_voice' : 'handle_query',
      status: 'ok',
      userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      requestLike: { correlationId },
      details: {
        month,
        year,
        channel,
        response_chars: cleanedReply.length,
        confirmed_count: Number(structuredContext?.meta?.confirmed_count || 0),
        predicted_count: Number(structuredContext?.meta?.predicted_count || 0),
        uncertain_count: Number(structuredContext?.meta?.uncertain_count || 0),
        proposed_actions_count: persistedProposal ? 1 : 0,
      },
    });

    return {
      reply: cleanedReply,
      context: {
        month,
        year,
        income: summary.income,
        total_expenses: summary.total_expenses,
        savings: summary.savings,
        savings_rate: summary.savings_rate,
        overspending_flags: summary.overspending_flags,
        structured_context: structuredContext,
        structured_context_meta: structuredContext.meta,
        all_time_context: summary.all_time_context || null,
      },
      proposed_actions: persistedProposal ? [persistedProposal] : [],
      requires_confirmation: Boolean(persistedProposal),
    };
  } catch (err) {
    logServiceEvent({
      service: 'ai.controller',
      operation: channel === 'voice' ? 'handle_voice' : 'handle_query',
      status: 'error',
      userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: err,
      details: {
        month,
        year,
        channel,
      },
    });

    throw err;
  }
};

const handleQuery = async (req, res) => {
  const { message, month, year } = req.body;
  const correlationId = getRequestCorrelationId(req) || makeCorrelationId();
  let parsed;
  let inputText;

  try {
    parsed = budgetService.parseMonthYear(month, year);
    inputText = parseInputText(message, 'message');
  } catch (err) {
    logServiceEvent({
      service: 'ai.controller',
      operation: 'handle_query',
      status: 'error',
      userId: req.userId,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: err,
      details: {
        stage: 'input_validation',
      },
    });

    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  try {
    const response = await generateAiReply({
      userId: req.userId,
      inputText,
      month: parsed.month,
      year: parsed.year,
      channel: 'text',
      correlationId,
    });

    return res.status(200).json({
      ...response,
      correlation_id: correlationId,
    });
  } catch (err) {
    return handleAiError(res, err, 'Server error processing AI query');
  }
};

const handleVoice = async (req, res) => {
  const { transcript, message, month, year } = req.body;
  const correlationId = getRequestCorrelationId(req) || makeCorrelationId();
  let parsed;
  let inputText;

  try {
    parsed = budgetService.parseMonthYear(month, year);
    inputText = parseInputText(transcript || message, 'transcript');
  } catch (err) {
    logServiceEvent({
      service: 'ai.controller',
      operation: 'handle_voice',
      status: 'error',
      userId: req.userId,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: err,
      details: {
        stage: 'input_validation',
      },
    });

    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  try {
    const response = await generateAiReply({
      userId: req.userId,
      inputText,
      month: parsed.month,
      year: parsed.year,
      channel: 'voice',
      correlationId,
    });

    return res.status(200).json({
      ...response,
      transcript: inputText,
      correlation_id: correlationId,
    });
  } catch (err) {
    return handleAiError(res, err, 'Server error processing AI voice query');
  }
};

const confirmAction = async (req, res) => {
  const correlationId = getRequestCorrelationId(req) || makeCorrelationId();
  const startedAt = Date.now();
  const proposalId = typeof req.body?.proposal_id === 'string' ? req.body.proposal_id.trim() : '';
  const decision = req.body?.decision;

  if (!proposalId) {
    return res.status(400).json({ error: 'proposal_id is required' });
  }

  try {
    const result = await executeConfirmedAction({
      proposalId,
      userId: req.userId,
      decision,
    });

    logServiceEvent({
      service: 'ai.controller',
      operation: 'confirm_action',
      status: 'ok',
      userId: req.userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: false,
      requestLike: { correlationId },
      details: {
        proposal_id: proposalId,
        decision: result.decision,
        action_type: result.type,
        action_status: result.status,
      },
    });

    return res.status(200).json({
      ...result,
      correlation_id: correlationId,
    });
  } catch (err) {
    logServiceEvent({
      service: 'ai.controller',
      operation: 'confirm_action',
      status: 'error',
      userId: req.userId,
      latencyMs: Date.now() - startedAt,
      fallbackUsed: true,
      requestLike: { correlationId },
      error: err,
      details: {
        proposal_id: proposalId,
      },
    });

    return handleAiError(res, err, 'Server error confirming AI action');
  }
};

const getHistory = async (req, res) => {
  const userId = req.userId;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

  try {
    const result = await db.query(
      `SELECT log_id, input_text, response_text, channel, created_at
       FROM ai_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    const history = result.rows.map((row) => ({
      id: row.log_id,
      message: row.input_text,
      reply: row.response_text,
      channel: row.channel,
      created_at: row.created_at,
    }));

    return res.status(200).json({ history });
  } catch (err) {
    console.error('getHistory error:', err.message);
    return res.status(500).json({ error: 'Server error fetching AI history' });
  }
};

module.exports = {
  handleQuery,
  handleVoice,
  confirmAction,
  getHistory,
};
