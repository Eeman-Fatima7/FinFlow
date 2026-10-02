const db = require('../../db/db');

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeRulePattern = (value) => toTrimmedString(value).toUpperCase();

const normalizeMatchType = (value) => {
  const normalized = toTrimmedString(value).toLowerCase();
  return normalized === 'contains' ? 'contains' : 'exact';
};

const ensureCategoryExists = async (categoryId) => {
  const numericCategoryId = Number(categoryId);
  if (!Number.isInteger(numericCategoryId) || numericCategoryId <= 0) return null;

  const result = await db.query(
    'SELECT category_id, name FROM categories WHERE category_id = $1 LIMIT 1',
    [numericCategoryId]
  );

  return result.rows[0] || null;
};

const getCategoryByName = async (name) => {
  const normalized = toTrimmedString(name);
  if (!normalized) return null;

  const result = await db.query(
    'SELECT category_id, name FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1',
    [normalized]
  );

  return result.rows[0] || null;
};

const mapRuleRow = (row) => ({
  id: row.id,
  user_id: row.user_id,
  pattern: row.pattern,
  category_id: row.category_id,
  category_name: row.category_name,
  match_type: row.match_type,
  source: row.source,
  use_count: Number(row.use_count || 0),
  created_at: row.created_at,
  updated_at: row.updated_at,
  confidence: 1,
});

const loadMerchantCategoryRules = async (userId) => {
  const result = await db.query(
    `SELECT
      r.id,
      r.user_id,
      r.pattern,
      r.category_id,
      r.match_type,
      r.source,
      r.use_count,
      r.created_at,
      r.updated_at,
      c.name AS category_name
     FROM merchant_category_rules r
     JOIN categories c ON c.category_id = r.category_id
     WHERE r.user_id = $1
     ORDER BY LENGTH(r.pattern) DESC, r.updated_at DESC`,
    [userId]
  );

  return result.rows.map(mapRuleRow);
};

const listMerchantCategoryRules = async (userId) => loadMerchantCategoryRules(userId);

const upsertMerchantCategoryRule = async ({
  userId,
  pattern,
  categoryId,
  categoryName,
  matchType = 'exact',
  source = 'user_correction',
  useCountIncrement = 1,
}) => {
  const normalizedPattern = normalizeRulePattern(pattern);
  if (!normalizedPattern) {
    const err = new Error('pattern is required');
    err.statusCode = 400;
    throw err;
  }

  const normalizedMatchType = normalizeMatchType(matchType);
  const normalizedSource = toTrimmedString(source) || 'user_correction';
  const increment = Number.isInteger(Number(useCountIncrement)) && Number(useCountIncrement) > 0
    ? Number(useCountIncrement)
    : 1;

  let resolvedCategory = await ensureCategoryExists(categoryId);
  if (!resolvedCategory) {
    resolvedCategory = await getCategoryByName(categoryName);
  }

  if (!resolvedCategory) {
    const err = new Error('Category does not exist');
    err.statusCode = 400;
    throw err;
  }

  const inserted = await db.query(
    `INSERT INTO merchant_category_rules
      (user_id, pattern, category_id, match_type, source, use_count, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id, pattern, match_type)
     DO UPDATE SET
       category_id = EXCLUDED.category_id,
       source = EXCLUDED.source,
       use_count = merchant_category_rules.use_count + EXCLUDED.use_count,
       updated_at = NOW()
     RETURNING id, user_id, pattern, category_id, match_type, source, use_count, created_at, updated_at`,
    [userId, normalizedPattern, resolvedCategory.category_id, normalizedMatchType, normalizedSource, increment]
  );

  const row = inserted.rows[0];

  return {
    ...mapRuleRow({ ...row, category_name: resolvedCategory.name }),
    category_name: resolvedCategory.name,
  };
};

const upsertUserCorrectionRule = async ({ userId, pattern, categoryId, categoryName }) => {
  if (!toTrimmedString(pattern)) return null;

  try {
    return await upsertMerchantCategoryRule({
      userId,
      pattern,
      categoryId,
      categoryName,
      matchType: 'exact',
      source: 'user_correction',
      useCountIncrement: 1,
    });
  } catch (err) {
    if (err.statusCode === 400 && err.message === 'Category does not exist') {
      return null;
    }
    throw err;
  }
};

const deleteMerchantCategoryRule = async ({ userId, ruleId }) => {
  const numericRuleId = Number(ruleId);
  if (!Number.isInteger(numericRuleId) || numericRuleId <= 0) {
    const err = new Error('id must be a positive integer');
    err.statusCode = 400;
    throw err;
  }

  const result = await db.query(
    `DELETE FROM merchant_category_rules
     WHERE id = $1
       AND user_id = $2
     RETURNING id`,
    [numericRuleId, userId]
  );

  if (result.rows.length === 0) {
    const err = new Error('Rule not found');
    err.statusCode = 404;
    throw err;
  }
};

const findMatchingMerchantRule = ({ description, merchant, rules = [] }) => {
  if (!Array.isArray(rules) || rules.length === 0) return null;

  const merchantKey = normalizeRulePattern(merchant);
  const descriptionKey = normalizeRulePattern(description);

  for (const rule of rules) {
    const pattern = normalizeRulePattern(rule.pattern);
    if (!pattern) continue;

    const matchType = normalizeMatchType(rule.match_type);
    let isMatch = false;

    if (matchType === 'contains') {
      isMatch = (merchantKey && merchantKey.includes(pattern)) || descriptionKey.includes(pattern);
    } else {
      isMatch = (merchantKey && merchantKey === pattern) || (!merchantKey && descriptionKey === pattern);
    }

    if (isMatch) {
      return {
        id: rule.id,
        pattern,
        category_id: rule.category_id,
        category_name: rule.category_name,
        match_type: matchType,
        source: rule.source || 'user_correction',
        use_count: Number(rule.use_count || 0),
        confidence: 1,
      };
    }
  }

  return null;
};

module.exports = {
  normalizeRulePattern,
  listMerchantCategoryRules,
  upsertMerchantCategoryRule,
  upsertUserCorrectionRule,
  deleteMerchantCategoryRule,
  loadMerchantCategoryRules,
  findMatchingMerchantRule,
};
