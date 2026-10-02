const advisorService = require('../services/advisorService');
const budgetService = require('../services/budgetService');
const db = require('../db/db');

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertContextItem = (item, path) => {
  assert(item && typeof item === 'object', `${path} must be an object`);
  assert(typeof item.id === 'string' && item.id.trim(), `${path}.id must be a non-empty string`);
  assert(typeof item.kind === 'string' && item.kind.trim(), `${path}.kind must be a non-empty string`);
  assert(typeof item.statement === 'string' && item.statement.trim(), `${path}.statement must be a non-empty string`);
  assert(['high', 'medium', 'low'].includes(item.confidence), `${path}.confidence must be high|medium|low`);
  assert(item.provenance && typeof item.provenance === 'object', `${path}.provenance must exist`);
  assert(typeof item.provenance.service === 'string' && item.provenance.service.trim(), `${path}.provenance.service must be non-empty`);
  assert(typeof item.provenance.as_of === 'string' && item.provenance.as_of.trim(), `${path}.provenance.as_of must be non-empty`);
};

const run = async () => {
  const userResult = await db.query(
    `SELECT user_id
     FROM users
     ORDER BY user_id ASC
     LIMIT 1`
  );

  if (!userResult.rows[0]) {
    throw new Error('No users available for Phase 7 AI context smoke test');
  }

  const userId = Number(userResult.rows[0].user_id);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const analysis = await budgetService.analyzeSpending(userId, month, year);
  const summary = await advisorService.getUserSummary(userId, month, year, analysis);

  assert(summary && typeof summary === 'object', 'Summary payload missing');

  assert(typeof summary.income === 'number', 'Summary.income must be a number');
  assert(typeof summary.total_expenses === 'number', 'Summary.total_expenses must be a number');
  assert(typeof summary.savings === 'number', 'Summary.savings must be a number');
  assert(typeof summary.savings_rate === 'number', 'Summary.savings_rate must be a number');

  const structured = summary.structured_context;
  assert(structured && typeof structured === 'object', 'structured_context missing');
  assert(Array.isArray(structured.confirmed), 'structured_context.confirmed must be an array');
  assert(Array.isArray(structured.predicted), 'structured_context.predicted must be an array');
  assert(Array.isArray(structured.uncertain), 'structured_context.uncertain must be an array');

  structured.confirmed.forEach((item, index) => assertContextItem(item, `confirmed[${index}]`));
  structured.predicted.forEach((item, index) => assertContextItem(item, `predicted[${index}]`));
  structured.uncertain.forEach((item, index) => assertContextItem(item, `uncertain[${index}]`));

  assert(structured.meta && typeof structured.meta === 'object', 'structured_context.meta missing');
  assert(typeof structured.meta.generated_at === 'string', 'structured_context.meta.generated_at missing');
  assert(typeof structured.meta.confirmed_count === 'number', 'structured_context.meta.confirmed_count missing');
  assert(typeof structured.meta.predicted_count === 'number', 'structured_context.meta.predicted_count missing');
  assert(typeof structured.meta.uncertain_count === 'number', 'structured_context.meta.uncertain_count missing');
  assert(Array.isArray(structured.meta.quality_flags), 'structured_context.meta.quality_flags must be an array');

  const prompts = advisorService.buildPrompt(summary, 'How should I budget next month?');

  assert(typeof prompts.systemPrompt === 'string' && prompts.systemPrompt.trim(), 'systemPrompt missing');
  assert(typeof prompts.userPrompt === 'string' && prompts.userPrompt.trim(), 'userPrompt missing');

  assert(prompts.userPrompt.includes('Confirmed facts:'), 'Prompt missing Confirmed facts section');
  assert(prompts.userPrompt.includes('Predicted outlook:'), 'Prompt missing Predicted outlook section');
  assert(prompts.userPrompt.includes('Uncertain signals:'), 'Prompt missing Uncertain signals section');

  const summaryPayload = {
    user_id: userId,
    month: summary.month,
    year: summary.year,
    confirmed_count: structured.meta.confirmed_count,
    predicted_count: structured.meta.predicted_count,
    uncertain_count: structured.meta.uncertain_count,
    quality_flags: structured.meta.quality_flags,
    prompt_sections: {
      has_confirmed: prompts.userPrompt.includes('Confirmed facts:'),
      has_predicted: prompts.userPrompt.includes('Predicted outlook:'),
      has_uncertain: prompts.userPrompt.includes('Uncertain signals:'),
    },
  };

  return summaryPayload;
};

if (require.main === module) {
  run()
    .then((summary) => {
      console.log('Phase 7 AI context smoke test passed');
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Phase 7 AI context smoke test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { run };