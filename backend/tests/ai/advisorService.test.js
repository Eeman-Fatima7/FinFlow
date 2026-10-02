const assert = require('assert');

const dbPath = require.resolve('../../db/db');
const budgetServicePath = require.resolve('../../services/budgetService');
const forecastHistoryPath = require.resolve('../../services/forecast/forecastHistoryService');
const anomalyOrchestratorPath = require.resolve('../../services/anomalies/anomalyOrchestratorService');
const importSessionPath = require.resolve('../../services/import/sessionService');
const eventLoggerPath = require.resolve('../../services/observability/eventLogger');
const mlConfigPath = require.resolve('../../config/mlConfig');
const axiosPath = require.resolve('axios');

[
  dbPath,
  budgetServicePath,
  forecastHistoryPath,
  anomalyOrchestratorPath,
  importSessionPath,
  eventLoggerPath,
  mlConfigPath,
  axiosPath,
].forEach((path) => {
  delete require.cache[path];
});

const axiosCalls = [];
let nextAxiosResponse = {
  data: {
    choices: [
      {
        message: {
          content: 'default assistant response',
        },
      },
    ],
  },
};
let nextAxiosError = null;

const axiosStub = {
  post: async (url, payload, config) => {
    axiosCalls.push({ url, payload, config });

    if (nextAxiosError) {
      throw nextAxiosError;
    }

    return nextAxiosResponse;
  },
};

const noopAsync = async () => null;

const dbStub = {
  query: async () => ({ rows: [] }),
};

const budgetServiceStub = {
  analyzeSpending: noopAsync,
};

const forecastHistoryStub = {
  getForecastHistoryForUser: noopAsync,
};

const anomalyOrchestratorStub = {
  getDashboardAnomalySummary: noopAsync,
};

const importSessionStub = {
  getLatestImportSessionSnapshotForUser: noopAsync,
};

const loggedEvents = [];
const eventLoggerStub = {
  logServiceEvent: (payload) => {
    loggedEvents.push(payload);
  },
  makeCorrelationId: () => 'corr-advisor-test',
};

const mlConfigStub = {
  AMBIGUITY_MARGIN: 0.08,
};

require.cache[axiosPath] = {
  id: axiosPath,
  filename: axiosPath,
  loaded: true,
  exports: axiosStub,
};

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: dbStub,
};

require.cache[budgetServicePath] = {
  id: budgetServicePath,
  filename: budgetServicePath,
  loaded: true,
  exports: budgetServiceStub,
};

require.cache[forecastHistoryPath] = {
  id: forecastHistoryPath,
  filename: forecastHistoryPath,
  loaded: true,
  exports: forecastHistoryStub,
};

require.cache[anomalyOrchestratorPath] = {
  id: anomalyOrchestratorPath,
  filename: anomalyOrchestratorPath,
  loaded: true,
  exports: anomalyOrchestratorStub,
};

require.cache[importSessionPath] = {
  id: importSessionPath,
  filename: importSessionPath,
  loaded: true,
  exports: importSessionStub,
};

require.cache[eventLoggerPath] = {
  id: eventLoggerPath,
  filename: eventLoggerPath,
  loaded: true,
  exports: eventLoggerStub,
};

require.cache[mlConfigPath] = {
  id: mlConfigPath,
  filename: mlConfigPath,
  loaded: true,
  exports: mlConfigStub,
};

process.env.ECOMAGENT_API_KEY = process.env.ECOMAGENT_API_KEY || 'test-api-key';
process.env.ECOMAGENT_MODEL = 'claude-opus-4.6';
process.env.ECOMAGENT_BASE_URL = process.env.ECOMAGENT_BASE_URL || 'https://api.ecomagent.in/v1';

const advisorService = require('../../services/advisorService');

const resetState = () => {
  axiosCalls.length = 0;
  loggedEvents.length = 0;
  nextAxiosError = null;
  nextAxiosResponse = {
    data: {
      choices: [
        {
          message: {
            content: 'default assistant response',
          },
        },
      ],
    },
  };
};

const testCallLlmReadsStringMessageContent = async () => {
  resetState();

  nextAxiosResponse = {
    data: {
      choices: [
        {
          message: {
            content: '  Budget spend looks stable this month.  ',
          },
        },
      ],
    },
  };

  const reply = await advisorService.callLLM(
    {
      systemPrompt: 'sys',
      userPrompt: 'user',
    },
    {
      userId: 17,
      channel: 'text',
      correlationId: 'corr-1',
    }
  );

  assert.strictEqual(reply, 'Budget spend looks stable this month.');
  assert.strictEqual(axiosCalls.length, 1);
};

const testCallLlmRetriesWithFallbackModelWhenPrimaryIsEmpty = async () => {
  resetState();

  let callCount = 0;
  const originalPost = axiosStub.post;

  try {
    axiosStub.post = async (url, payload, config) => {
      callCount += 1;
      axiosCalls.push({ url, payload, config });

      if (callCount === 1) {
        return {
          data: {
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  reasoning_content: null,
                  tool_calls: null,
                },
              },
            ],
          },
        };
      }

      return {
        data: {
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Fallback model reply',
              },
            },
          ],
        },
      };
    };

    const reply = await advisorService.callLLM(
      {
        systemPrompt: 'sys',
        userPrompt: 'user',
      },
      {
        userId: 18,
        channel: 'text',
        correlationId: 'corr-2',
      }
    );

    assert.strictEqual(reply, 'Fallback model reply');
    assert.strictEqual(axiosCalls.length, 2);
    assert.strictEqual(axiosCalls[0].payload.model, 'claude-opus-4.6');
    assert.strictEqual(axiosCalls[1].payload.model, 'mmodel');
  } finally {
    axiosStub.post = originalPost;
  }
};

const testCallLlmReturnsGuidanceFallbackWhenAllModelsAreEmpty = async () => {
  resetState();

  nextAxiosResponse = {
    data: {
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            reasoning_content: null,
            tool_calls: null,
          },
        },
      ],
    },
  };

  const reply = await advisorService.callLLM(
    {
      systemPrompt: 'sys',
      userPrompt: 'user',
    },
    {
      userId: 118,
      channel: 'text',
      correlationId: 'corr-2b',
    }
  );

  assert.ok(reply.includes("I'm temporarily unable to retrieve a reliable AI-generated answer from the provider."));
};

const testCallLlmReadsChoiceTextFallback = async () => {
  resetState();

  nextAxiosResponse = {
    data: {
      choices: [
        {
          text: 'Use the 50/30/20 split as a starting point.',
          message: {
            content: null,
          },
        },
      ],
    },
  };

  const reply = await advisorService.callLLM(
    {
      systemPrompt: 'sys',
      userPrompt: 'user',
    },
    {
      userId: 19,
      channel: 'text',
      correlationId: 'corr-3',
    }
  );

  assert.strictEqual(reply, 'Use the 50/30/20 split as a starting point.');
};

const testCallLlmMapsProviderErrorTo503 = async () => {
  resetState();

  const upstreamErr = new Error('upstream failure');
  upstreamErr.response = {
    data: {
      error: {
        message: 'provider overloaded',
      },
    },
  };
  nextAxiosError = upstreamErr;

  let gotError = null;

  try {
    await advisorService.callLLM(
      {
        systemPrompt: 'sys',
        userPrompt: 'user',
      },
      {
        userId: 20,
        channel: 'text',
        correlationId: 'corr-4',
      }
    );
  } catch (err) {
    gotError = err;
  }

  assert.ok(gotError, 'Expected error to be thrown');
  assert.strictEqual(gotError.statusCode, 503);
  assert.strictEqual(gotError.message, 'LLM service unavailable: provider overloaded');
};

(async () => {
  try {
    await testCallLlmReadsStringMessageContent();
    await testCallLlmRetriesWithFallbackModelWhenPrimaryIsEmpty();
    await testCallLlmReturnsGuidanceFallbackWhenAllModelsAreEmpty();
    await testCallLlmReadsChoiceTextFallback();
    await testCallLlmMapsProviderErrorTo503();

    console.log('advisorService.test.js passed');
    process.exit(0);
  } catch (err) {
    console.error('advisorService.test.js failed:', err.message);
    process.exit(1);
  } finally {
    delete require.cache[require.resolve('../../services/advisorService')];
    [
      dbPath,
      budgetServicePath,
      forecastHistoryPath,
      anomalyOrchestratorPath,
      importSessionPath,
      eventLoggerPath,
      mlConfigPath,
      axiosPath,
    ].forEach((path) => {
      delete require.cache[path];
    });
  }
})();
