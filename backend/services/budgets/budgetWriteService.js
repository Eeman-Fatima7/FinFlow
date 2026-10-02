const db = require('../../db/db');
const budgetService = require('../budgetService');

const toPositiveNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    const err = new Error('monthly_limit must be greater than 0');
    err.statusCode = 400;
    throw err;
  }

  return Number(numeric.toFixed(2));
};

const toPositiveInt = (value, fieldName) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    const err = new Error(`${fieldName} must be a positive integer`);
    err.statusCode = 400;
    throw err;
  }

  return numeric;
};

const parseMonthYear = (monthInput, yearInput) => {
  return budgetService.parseMonthYear(monthInput, yearInput);
};

const requireExpenseCategoryById = async ({ categoryId, dbClient = db }) => {
  const safeCategoryId = toPositiveInt(categoryId, 'category_id');

  const result = await dbClient.query(
    `SELECT category_id, name, type
     FROM categories
     WHERE category_id = $1
     LIMIT 1`,
    [safeCategoryId]
  );

  if (!result.rows[0]) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    throw err;
  }

  if (String(result.rows[0].type || '').toLowerCase() === 'income') {
    const err = new Error('Budget category must be an expense category');
    err.statusCode = 400;
    throw err;
  }

  return result.rows[0];
};

const findExpenseCategoryByName = async ({ categoryName, dbClient = db }) => {
  const normalizedName = typeof categoryName === 'string' ? categoryName.trim() : '';
  if (!normalizedName) {
    const err = new Error('category is required');
    err.statusCode = 400;
    throw err;
  }

  const result = await dbClient.query(
    `SELECT category_id, name, type
     FROM categories
     WHERE LOWER(name) = LOWER($1)
     LIMIT 1`,
    [normalizedName]
  );

  if (!result.rows[0]) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    throw err;
  }

  if (String(result.rows[0].type || '').toLowerCase() === 'income') {
    const err = new Error('Budget category must be an expense category');
    err.statusCode = 400;
    throw err;
  }

  return result.rows[0];
};

const upsertBudget = async ({ userId, categoryId, monthlyLimit, month, year, dbClient = db }) => {
  const safeUserId = toPositiveInt(userId, 'user_id');
  const category = await requireExpenseCategoryById({ categoryId, dbClient });
  const safeLimit = toPositiveNumber(monthlyLimit);
  const parsed = parseMonthYear(month, year);

  const result = await dbClient.query(
    `INSERT INTO budgets (user_id, category_id, monthly_limit, month, year)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, category_id, month, year)
     DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit
     RETURNING *`,
    [safeUserId, category.category_id, safeLimit, parsed.month, parsed.year]
  );

  return {
    budget: result.rows[0],
    category,
  };
};

module.exports = {
  toPositiveInt,
  parseMonthYear,
  requireExpenseCategoryById,
  findExpenseCategoryByName,
  upsertBudget,
};
