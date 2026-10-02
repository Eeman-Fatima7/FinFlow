const assert = require('assert');

const budgetServicePath = require.resolve('../../services/budgetService');
const advisorServicePath = require.resolve('../../services/advisorService');
const actionProposalServicePath = require.resolve('../../services/ai/actionProposalService');
const actionExecutionServicePath = require.resolve('../../services/ai/actionExecutionService');
const eventLoggerPath = require.resolve('../../services/observability/eventLogger');
const dbPath = require.resolve('../../db/db');

[
  budgetServicePath,
  advisorServicePath,
  actionProposalServicePath,
  actionExecutionServicePath,
  eventLoggerPath,
  dbPath,
].forEach((path) => {
  delete require.cache[path];
});

const calls = {
  refreshSuggestionsForUser: [],
  getUserSummary: [],
  buildPrompt: [],
  callLLM: [],
  logInteraction: [],
  parseAssistantOutput: [],
  persistActionProposal: [],
  executeConfirmedAction: [],
  logServiceEvent: [],
  dbQuery: [],
};

let llmResponse = 'assistant reply';
let parsedOutputResponse = {
  reply_text: 'assistant reply',
  proposal: null,
  proposal_error: null,
};
let persistedProposalResponse = null;
let executeConfirmedActionResponse = {
  proposal_id: 'pid-1',
  decision: 'confirm',
  status: 'executed',
  executed: true,
  type: 'create_budget',
};
let forcePersistProposalError = null;
let forceExecuteActionError = null;
let forceCallLlmError = null;

const budgetServiceStub = {
  parseMonthYear: (month, year) => ({
    month: Number(month) || 4,
    year: Number(year) || 2026,
  }),
  refreshSuggestionsForUser: async (userId, month, year) => {
    calls.refreshSuggestionsForUser.push({ userId, month, year });
    return {
      analysis: {
        month,
        year,
      },
    };
  },
};

const advisorServiceStub = {
  getUserSummary: async (userId, month, year, analysis, options) => {
    calls.getUserSummary.push({ userId, month, year, analysis, options });
    return {
      income: 200000,
      total_expenses: 120000,
      savings: 80000,
      savings_rate: 40,
      overspending_flags: [],
      all_time_context: { lifetime_totals: { income: 1000000 } },
      structured_context: {
        confirmed: [],
        predicted: [],
        uncertain: [],
        meta: {
          confirmed_count: 0,
          predicted_count: 0,
          uncertain_count: 0,
        },
      },
    };
  },
  buildPrompt: (summary, inputText) => {
    calls.buildPrompt.push({ summary, inputText });
    return {
      systemPrompt: 'sys',
      userPrompt: `user:${inputText}`,
    };
  },
  callLLM: async (prompts, options) => {
    calls.callLLM.push({ prompts, options });
    if (forceCallLlmError) throw forceCallLlmError;
    return llmResponse;
  },
  logInteraction: async (userId, inputText, reply, channel) => {
    calls.logInteraction.push({ userId, inputText, reply, channel });
    return {
      log_id: 88,
    };
  },
};

const actionProposalServiceStub = {
  parseAssistantOutput: (raw) => {
    calls.parseAssistantOutput.push(raw);
    return parsedOutputResponse;
  },
  persistActionProposal: async (payload) => {
    calls.persistActionProposal.push(payload);
    if (forcePersistProposalError) throw forcePersistProposalError;
    return persistedProposalResponse;
  },
};

const actionExecutionServiceStub = {
  executeConfirmedAction: async (payload) => {
    calls.executeConfirmedAction.push(payload);
    if (forceExecuteActionError) throw forceExecuteActionError;
    return executeConfirmedActionResponse;
  },
};

let correlationCounter = 0;
const eventLoggerStub = {
  logServiceEvent: (payload) => {
    calls.logServiceEvent.push(payload);
  },
  getRequestCorrelationId: (req) => req.headers?.['x-correlation-id'] || null,
  makeCorrelationId: () => {
    correlationCounter += 1;
    return `corr-${correlationCounter}`;
  },
};

const dbStub = {
  query: async (sql, params) => {
    calls.dbQuery.push({ sql, params });
    return {
      rows: [
        {
          log_id: 1,
          input_text: 'hello',
          response_text: 'world',
          channel: 'text',
          created_at: '2026-04-24T00:00:00.000Z',
        },
      ],
    };
  },
};

require.cache[budgetServicePath] = {
  id: budgetServicePath,
  filename: budgetServicePath,
  loaded: true,
  exports: budgetServiceStub,
};
require.cache[advisorServicePath] = {
  id: advisorServicePath,
  filename: advisorServicePath,
  loaded: true,
  exports: advisorServiceStub,
};
require.cache[actionProposalServicePath] = {
  id: actionProposalServicePath,
  filename: actionProposalServicePath,
  loaded: true,
  exports: actionProposalServiceStub,
};
require.cache[actionExecutionServicePath] = {
  id: actionExecutionServicePath,
  filename: actionExecutionServicePath,
  loaded: true,
  exports: actionExecutionServiceStub,
};
require.cache[eventLoggerPath] = {
  id: eventLoggerPath,
  filename: eventLoggerPath,
  loaded: true,
  exports: eventLoggerStub,
};
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: dbStub,
};

const aiController = require('../../controllers/aiController');

const resetState = () => {
  Object.values(calls).forEach((arr) => {
    arr.length = 0;
  });

  llmResponse = 'assistant reply';
  parsedOutputResponse = {
    reply_text: 'assistant reply',
    proposal: null,
    proposal_error: null,
  };
  persistedProposalResponse = null;
  executeConfirmedActionResponse = {
    proposal_id: 'pid-1',
    decision: 'confirm',
    status: 'executed',
    executed: true,
    type: 'create_budget',
  };
  forcePersistProposalError = null;
  forceExecuteActionError = null;
  forceCallLlmError = null;
  correlationCounter = 0;
};

const makeReq = ({ body = {}, query = {}, params = {}, headers = {}, userId = 7 } = {}) => ({
  body,
  query,
  params,
  headers,
  userId,
});

const makeRes = () => {
  const state = { statusCode: null, payload: null };

  return {
    status: (code) => {
      state.statusCode = code;
      return {
        json: (payload) => {
          state.payload = payload;
          return state;
        },
      };
    },
    state,
  };
};

const testHandleQueryWithoutProposal = async () => {
  resetState();

  const req = makeReq({
    body: {
      message: 'How am I doing?',
      month: 4,
      year: 2026,
    },
    headers: {
      'x-correlation-id': 'cid-query-1',
    },
  });
  const res = makeRes();

  await aiController.handleQuery(req, res);

  assert.strictEqual(res.state.statusCode, 200);
  assert.strictEqual(res.state.payload.reply, 'assistant reply');
  assert.deepStrictEqual(res.state.payload.proposed_actions, []);
  assert.strictEqual(res.state.payload.requires_confirmation, false);
  assert.strictEqual(res.state.payload.correlation_id, 'cid-query-1');

  assert.strictEqual(calls.parseAssistantOutput.length, 1);
  assert.strictEqual(calls.persistActionProposal.length, 0);
};

const testHandleQueryWithProposal = async () => {
  resetState();

  parsedOutputResponse = {
    reply_text: 'I can do that for you.',
    proposal: {
      type: 'create_budget',
      payload: {
        category_id: 4,
        monthly_limit: 18000,
        month: 4,
        year: 2026,
      },
      confirmation_summary: 'Set Groceries budget to 18,000 PKR',
    },
    proposal_error: null,
  };

  persistedProposalResponse = {
    proposal_id: 'proposal-123',
    type: 'create_budget',
    payload: {
      category_id: 4,
      monthly_limit: 18000,
      month: 4,
      year: 2026,
    },
    confirmation_summary: 'Set Groceries budget to 18,000 PKR',
    status: 'pending',
    expires_at: '2026-04-24T01:00:00.000Z',
  };

  const req = makeReq({
    body: {
      message: 'Set my groceries budget to 18k this month',
      month: 4,
      year: 2026,
    },
  });
  const res = makeRes();

  await aiController.handleQuery(req, res);

  assert.strictEqual(res.state.statusCode, 200);
  assert.strictEqual(res.state.payload.reply, 'I can do that for you.');
  assert.strictEqual(res.state.payload.requires_confirmation, true);
  assert.strictEqual(res.state.payload.proposed_actions.length, 1);
  assert.strictEqual(res.state.payload.proposed_actions[0].proposal_id, 'proposal-123');
  assert.strictEqual(calls.persistActionProposal.length, 1);
};

const testHandleQueryProposalPersistFailureDegrades = async () => {
  resetState();

  parsedOutputResponse = {
    reply_text: 'I can do that for you.',
    proposal: {
      type: 'create_goal',
      payload: {
        title: 'Bike',
        target_amount: 90000,
      },
      confirmation_summary: 'Create bike goal',
    },
    proposal_error: null,
  };
  forcePersistProposalError = new Error('DB unavailable');

  const req = makeReq({
    body: {
      message: 'Create a bike goal',
    },
  });
  const res = makeRes();

  await aiController.handleQuery(req, res);

  assert.strictEqual(res.state.statusCode, 200);
  assert.deepStrictEqual(res.state.payload.proposed_actions, []);
  assert.strictEqual(res.state.payload.requires_confirmation, false);

  const degradedEvent = calls.logServiceEvent.find((event) => event.status === 'degraded');
  assert.ok(degradedEvent, 'Expected degraded event when proposal persistence fails');
};

const testConfirmActionSuccess = async () => {
  resetState();

  executeConfirmedActionResponse = {
    proposal_id: 'proposal-555',
    decision: 'confirm',
    status: 'executed',
    executed: true,
    type: 'create_goal',
    result: { entity: 'goal' },
  };

  const req = makeReq({
    body: {
      proposal_id: 'proposal-555',
      decision: 'confirm',
    },
    headers: {
      'x-correlation-id': 'cid-confirm-1',
    },
    userId: 12,
  });
  const res = makeRes();

  await aiController.confirmAction(req, res);

  assert.strictEqual(res.state.statusCode, 200);
  assert.strictEqual(res.state.payload.status, 'executed');
  assert.strictEqual(res.state.payload.correlation_id, 'cid-confirm-1');
  assert.strictEqual(calls.executeConfirmedAction.length, 1);
  assert.deepStrictEqual(calls.executeConfirmedAction[0], {
    proposalId: 'proposal-555',
    userId: 12,
    decision: 'confirm',
  });
};

const testConfirmActionMissingProposalId = async () => {
  resetState();

  const req = makeReq({
    body: {
      decision: 'reject',
    },
  });
  const res = makeRes();

  await aiController.confirmAction(req, res);

  assert.strictEqual(res.state.statusCode, 400);
  assert.strictEqual(res.state.payload.error, 'proposal_id is required');
  assert.strictEqual(calls.executeConfirmedAction.length, 0);
};

const testConfirmActionErrorMapping = async () => {
  resetState();

  const err = new Error('Action proposal has expired');
  err.statusCode = 410;
  forceExecuteActionError = err;

  const req = makeReq({
    body: {
      proposal_id: 'proposal-expired',
      decision: 'confirm',
    },
  });
  const res = makeRes();

  await aiController.confirmAction(req, res);

  assert.strictEqual(res.state.statusCode, 410);
  assert.strictEqual(res.state.payload.error, 'Action proposal has expired');
};

const testGetHistory = async () => {
  resetState();

  const req = makeReq({ query: { limit: 10 }, userId: 33 });
  const res = makeRes();

  await aiController.getHistory(req, res);

  assert.strictEqual(res.state.statusCode, 200);
  assert.strictEqual(Array.isArray(res.state.payload.history), true);
  assert.strictEqual(calls.dbQuery.length, 1);
};

const main = async () => {
  const tests = [
    testHandleQueryWithoutProposal,
    testHandleQueryWithProposal,
    testHandleQueryProposalPersistFailureDegrades,
    testConfirmActionSuccess,
    testConfirmActionMissingProposalId,
    testConfirmActionErrorMapping,
    testGetHistory,
  ];

  for (const test of tests) {
    await test();
  }

  console.log('aiController.test.js passed');
};

main().catch((err) => {
  console.error('aiController.test.js failed:', err.message);
  process.exit(1);
});
