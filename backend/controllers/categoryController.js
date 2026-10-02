const db = require('../db/db');
const {
  listMerchantCategoryRules,
  upsertMerchantCategoryRule,
  deleteMerchantCategoryRule,
} = require('../services/transactions/merchantCategoryRuleService');

const getCategories = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT category_id, name, type, icon, color
       FROM categories
       ORDER BY CASE WHEN type = 'expense' THEN 0 ELSE 1 END, name`
    );

    return res.status(200).json({ categories: result.rows });
  } catch (err) {
    console.error('getCategories error:', err.message);
    return res.status(500).json({ error: 'Server error fetching categories' });
  }
};

const createCategory = async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const type = typeof req.body?.type === 'string' ? req.body.type.trim().toLowerCase() : 'expense';
  const icon = typeof req.body?.icon === 'string' ? req.body.icon.trim() : null;
  const color = typeof req.body?.color === 'string' ? req.body.color.trim() : null;

  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  if (name.length > 100) {
    return res.status(400).json({ error: 'Category name must be 100 characters or less' });
  }

  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({ error: 'Category type must be income or expense' });
  }

  if (icon && icon.length > 50) {
    return res.status(400).json({ error: 'Category icon must be 50 characters or less' });
  }

  if (color && color.length > 20) {
    return res.status(400).json({ error: 'Category color must be 20 characters or less' });
  }

  try {
    const existing = await db.query(
      'SELECT category_id FROM categories WHERE LOWER(name) = LOWER($1)',
      [name]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Category already exists' });
    }

    const inserted = await db.query(
      `INSERT INTO categories (name, type, icon, color)
       VALUES ($1, $2, $3, $4)
       RETURNING category_id, name, type, icon, color`,
      [name, type, icon, color]
    );

    return res.status(201).json({ category: inserted.rows[0] });
  } catch (err) {
    console.error('createCategory error:', err.message);
    return res.status(500).json({ error: 'Server error creating category' });
  }
};

const listMerchantRules = async (req, res) => {
  try {
    const rules = await listMerchantCategoryRules(req.userId);
    return res.status(200).json({ rules });
  } catch (err) {
    console.error('listMerchantRules error:', err.message);
    return res.status(500).json({ error: 'Server error fetching merchant category rules' });
  }
};

const upsertMerchantRule = async (req, res) => {
  try {
    const rule = await upsertMerchantCategoryRule({
      userId: req.userId,
      pattern: req.body?.pattern,
      categoryId: req.body?.category_id,
      categoryName: req.body?.category_name,
      matchType: req.body?.match_type,
      source: req.body?.source,
      useCountIncrement: req.body?.use_count_increment,
    });

    return res.status(201).json({ rule });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    console.error('upsertMerchantRule error:', err.message);
    return res.status(500).json({ error: 'Server error saving merchant category rule' });
  }
};

const deleteMerchantRule = async (req, res) => {
  try {
    await deleteMerchantCategoryRule({
      userId: req.userId,
      ruleId: req.params.id || req.params.ruleId,
    });

    return res.status(204).send();
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    console.error('deleteMerchantRule error:', err.message);
    return res.status(500).json({ error: 'Server error deleting merchant category rule' });
  }
};

module.exports = {
  getCategories,
  createCategory,
  listMerchantRules,
  upsertMerchantRule,
  deleteMerchantRule,
};
