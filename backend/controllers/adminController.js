const db = require('../db/db');
const { writeAdminAuditLog } = require('../services/observability/adminAuditService');
const { getClientIp, invalidateRoleCache } = require('../middleware/adminMiddleware');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ML_TIMEOUT_MS = 3000;

// ── Helper ─────────────────────────────────────────────────────────────────

const paginate = (page = 1, limit = 50) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(200, Math.max(1, parseInt(limit) || 50));
  return { offset: (p - 1) * l, page: p, limit: l };
};

const buildPaginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  total_pages: Math.ceil(total / limit),
});

// ── GET /admin/overview ───────────────────────────────────────────────────

const getOverview = async (req, res) => {
  try {
    // Parallel queries for dashboard stats
    const [
      userCountResult,
      txnCountResult,
      sessionCountResult,
      activeAnomaliesResult,
      openSupportResult,
      recentUsersResult,
      recentTxnsResult,
      recentSessionsResult,
      recentSupportResult,
    ] = await Promise.all([
      // Total & active users (users active in last 30 days = have transactions or login in last 30d)
      db.query(`
        SELECT
          COUNT(*)::int AS total_users,
          (SELECT COUNT(DISTINCT u.user_id)::int
           FROM users u
           LEFT JOIN transactions t ON t.user_id = u.user_id
             AND t.created_at > NOW() - INTERVAL '30 days'
           WHERE u.created_at <= NOW()) AS active_users_30d
        FROM users
      `),
      // Total transactions
      db.query(`SELECT COUNT(*)::int AS total_transactions FROM transactions`),
      // Total import sessions
      db.query(`SELECT COUNT(*)::int AS total_import_sessions FROM import_sessions`),
      // Active anomalies
      db.query(`SELECT COUNT(*)::int AS active_anomalies FROM anomalies WHERE status = 'active'`),
      // Open support tickets
      db.query(`SELECT COUNT(*)::int AS open_support_tickets FROM support_requests WHERE status = 'open'`),
      // Recent users (last 5)
      db.query(`
        SELECT u.user_id, u.name, u.email, u.city, u.created_at
        FROM users u ORDER BY u.created_at DESC LIMIT 5
      `),
      // Recent transactions (last 10)
      db.query(`
        SELECT t.transaction_id, t.user_id, u.name AS user_name, t.description,
               t.amount, t.type, t.merchant, t.created_at
        FROM transactions t
        JOIN users u ON u.user_id = t.user_id
        ORDER BY t.created_at DESC LIMIT 10
      `),
      // Recent import sessions (last 5)
      db.query(`
        SELECT i.import_session_id, i.user_id, u.name AS user_name,
               i.source_bank, i.state, i.created_at,
               (SELECT COUNT(*) FROM import_session_rows r WHERE r.import_session_id = i.import_session_id) AS row_count
        FROM import_sessions i
        JOIN users u ON u.user_id = i.user_id
        ORDER BY i.created_at DESC LIMIT 5
      `),
      // Recent support tickets (last 5)
      db.query(`
        SELECT s.support_request_id, s.user_id, u.name AS user_name, s.subject, s.status, s.created_at
        FROM support_requests s
        JOIN users u ON u.user_id = s.user_id
        ORDER BY s.created_at DESC LIMIT 5
      `),
    ]);

    const userRow = userCountResult.rows[0];
    const stats = {
      total_users: userRow.total_users,
      active_users_30d: userRow.active_users_30d,
      total_transactions: txnCountResult.rows[0].total_transactions,
      total_import_sessions: sessionCountResult.rows[0].total_import_sessions,
      active_anomalies: activeAnomaliesResult.rows[0].active_anomalies,
      open_support_tickets: openSupportResult.rows[0].open_support_tickets,
    };

    // ML health probe (non-blocking, graceful degradation)
    let mlHealth = { status: 'unknown', latency_ms: null, last_check: null };
    try {
      const start = Date.now();
      const mlResponse = await Promise.race([
        fetch(`${ML_SERVICE_URL}/health`, { signal: AbortSignal.timeout(ML_TIMEOUT_MS) }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ML_TIMEOUT_MS)),
      ]);
      if (mlResponse && mlResponse.ok) {
        mlHealth = {
          status: 'ok',
          latency_ms: Date.now() - start,
          last_check: new Date().toISOString(),
        };
      } else {
        mlHealth = { status: 'degraded', latency_ms: Date.now() - start, last_check: new Date().toISOString() };
      }
    } catch {
      mlHealth = { status: 'offline', latency_ms: null, last_check: new Date().toISOString() };
    }

    res.json({
      stats,
      recent_users: recentUsersResult.rows,
      recent_transactions: recentTxnsResult.rows,
      recent_import_sessions: recentSessionsResult.rows,
      recent_support: recentSupportResult.rows,
      ml_health: mlHealth,
    });
  } catch (err) {
    console.error('getOverview error:', err);
    res.status(500).json({ error: 'Failed to load overview' });
  }
};

// ── GET /admin/users ───────────────────────────────────────────────────────

const listUsers = async (req, res) => {
  try {
    const { search = '', role, status, city, occupation, page = 1, limit = 50, sort = 'created_at', order = 'desc' } = req.query;
    const { offset, page: p, limit: l } = paginate(page, limit);

    const allowedSorts = ['user_id', 'name', 'email', 'created_at', 'monthly_income'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const conditions = ['1=1'];
    const params = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(`(u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (role) {
      conditions.push(`u.role = $${paramIdx}`);
      params.push(role);
      paramIdx++;
    }
    if (status) {
      conditions.push(`u.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }
    if (city) {
      conditions.push(`u.city ILIKE $${paramIdx}`);
      params.push(`%${city}%`);
      paramIdx++;
    }
    if (occupation) {
      conditions.push(`u.occupation ILIKE $${paramIdx}`);
      params.push(`%${occupation}%`);
      paramIdx++;
    }

    const where = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM users u WHERE ${where}`,
      params
    );

    params.push(l, offset);
    const usersResult = await db.query(
      `SELECT
         u.user_id, u.name, u.email, u.role, u.status,
         u.monthly_income, u.city, u.occupation, u.created_at,
         (SELECT COUNT(*)::int FROM transactions t WHERE t.user_id = u.user_id) AS transaction_count,
         (SELECT COUNT(*)::int FROM support_requests s WHERE s.user_id = u.user_id) AS support_count
       FROM users u
       WHERE ${where}
       ORDER BY ${sortCol} ${sortOrder}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    res.json({
      users: usersResult.rows,
      ...buildPaginationMeta(countResult.rows[0].total, p, l),
    });

    await writeAdminAuditLog({
      actorUserId: req.userId, actorEmail: req.userEmail,
      action: 'list_users', resourceType: 'users', resourceId: null,
      ipAddress: getClientIp(req), userAgent: req.headers['user-agent'],
      requestPayload: { search, role, status, page, limit }, responseStatus: 200,
    });
  } catch (err) {
    console.error('listUsers error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
};

// ── GET /admin/users/:id ──────────────────────────────────────────────────

const getUserDetail = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (!userId || userId <= 0) return res.status(400).json({ error: 'Invalid user ID' });

    const userResult = await db.query(
      `SELECT user_id, name, email, role, status, monthly_income, city, occupation,
              phone, bio, avatar_url, created_at
       FROM users WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const [
      txnSummary,
      budgetsResult,
      goalsResult,
      importSessionsResult,
      aiLogsResult,
      supportResult,
      anomalyResult,
    ] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)::int AS transaction_count,
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::decimal AS total_income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::decimal AS total_expenses
        FROM transactions WHERE user_id = $1
      `, [userId]),
      db.query(`
        SELECT b.budget_id, b.category_id, c.name AS category_name, b.monthly_limit, b.month, b.year
        FROM budgets b JOIN categories c ON c.category_id = b.category_id
        WHERE b.user_id = $1 ORDER BY b.year DESC, b.month DESC LIMIT 20
      `, [userId]),
      db.query(`
        SELECT goal_id, title, target_amount, current_savings, deadline, status, created_at
        FROM goals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20
      `, [userId]),
      db.query(`
        SELECT import_session_id, file_name, source_bank, state, created_at,
          (SELECT COUNT(*) FROM import_session_rows r WHERE r.import_session_id = i.import_session_id) AS row_count
        FROM import_sessions i WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10
      `, [userId]),
      db.query(`SELECT COUNT(*)::int AS ai_query_count FROM ai_logs WHERE user_id = $1`, [userId]),
      db.query(`SELECT COUNT(*)::int AS support_count FROM support_requests WHERE user_id = $1`, [userId]),
      db.query(`
        SELECT COUNT(*)::int AS anomaly_count FROM anomalies WHERE user_id = $1 AND status = 'active'
      `, [userId]),
    ]);

    const txn = txnSummary.rows[0];
    const totalIncome = parseFloat(txn.total_income);
    const totalExpenses = parseFloat(txn.total_expenses);
    const savingsRate = totalIncome > 0
      ? Math.max(0, ((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(1)
      : null;

    res.json({
      user: userResult.rows[0],
      transaction_summary: {
        count: txn.transaction_count,
        total_income: txn.total_income,
        total_expenses: txn.total_expenses,
        savings_rate: savingsRate,
      },
      budgets: budgetsResult.rows,
      goals: goalsResult.rows,
      import_sessions: importSessionsResult.rows,
      ai_query_count: aiLogsResult.rows[0].ai_query_count,
      support_count: supportResult.rows[0].support_count,
      active_anomaly_count: anomalyResult.rows[0].anomaly_count,
    });

    await writeAdminAuditLog({
      actorUserId: req.userId, actorEmail: req.userEmail,
      action: 'view_user_detail', resourceType: 'user', resourceId: String(userId),
      ipAddress: getClientIp(req), userAgent: req.headers['user-agent'],
      requestPayload: null, responseStatus: 200,
    });
  } catch (err) {
    console.error('getUserDetail error:', err);
    res.status(500).json({ error: 'Failed to load user detail' });
  }
};

// ── PATCH /admin/users/:id ─────────────────────────────────────────────────

const patchUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (!userId || userId <= 0) return res.status(400).json({ error: 'Invalid user ID' });

    const { role, status: newStatus } = req.body;

    // Self-demotion protection
    if (userId === req.userId && role && role !== 'admin') {
      await writeAdminAuditLog({
        actorUserId: req.userId, actorEmail: req.userEmail,
        action: 'patch_user_role_denied_self_demotion', resourceType: 'user', resourceId: String(userId),
        ipAddress: getClientIp(req), userAgent: req.headers['user-agent'],
        requestPayload: { role }, responseStatus: 400,
      });
      return res.status(400).json({ error: 'Cannot demote yourself from admin role' });
    }

    const updates = [];
    const params = [];
    let paramIdx = 1;

    if (role && ['admin', 'user'].includes(role)) {
      updates.push(`role = $${paramIdx++}`);
      params.push(role);
    }
    if (newStatus && ['active', 'suspended'].includes(newStatus)) {
      updates.push(`status = $${paramIdx++}`);
      params.push(newStatus);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update (role or status)' });
    }

    params.push(userId);
    await db.query(
      `UPDATE users SET ${updates.join(', ')}, token_version = token_version + 1 WHERE user_id = $${paramIdx}`,
      params
    );

    // Invalidate role cache so change takes effect immediately
    invalidateRoleCache(userId);

    if (role) {
      await writeAdminAuditLog({
        actorUserId: req.userId, actorEmail: req.userEmail,
        action: 'patch_user_role', resourceType: 'user', resourceId: String(userId),
        ipAddress: getClientIp(req), userAgent: req.headers['user-agent'],
        requestPayload: { role }, responseStatus: 200,
      });
    }
    if (newStatus) {
      await writeAdminAuditLog({
        actorUserId: req.userId, actorEmail: req.userEmail,
        action: 'patch_user_status', resourceType: 'user', resourceId: String(userId),
        ipAddress: getClientIp(req), userAgent: req.headers['user-agent'],
        requestPayload: { status: newStatus }, responseStatus: 200,
      });
    }

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('patchUser error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// ── GET /admin/transactions ────────────────────────────────────────────────

const listTransactions = async (req, res) => {
  try {
    const {
      user_id, category_id, type, status, source,
      min_amount, max_amount, date_from, date_to,
      search, page = 1, limit = 100,
    } = req.query;

    const { offset, page: p, limit: l } = paginate(page, limit);

    const conditions = ['1=1'];
    const params = [];
    let paramIdx = 1;

    if (user_id) { conditions.push(`t.user_id = $${paramIdx++}`); params.push(parseInt(user_id)); }
    if (category_id) { conditions.push(`t.category_id = $${paramIdx++}`); params.push(parseInt(category_id)); }
    if (type) { conditions.push(`t.type = $${paramIdx++}`); params.push(type); }
    if (status) { conditions.push(`t.status = $${paramIdx++}`); params.push(status); }
    if (source) { conditions.push(`t.source = $${paramIdx++}`); params.push(source); }
    if (min_amount) { conditions.push(`t.amount >= $${paramIdx++}`); params.push(parseFloat(min_amount)); }
    if (max_amount) { conditions.push(`t.amount <= $${paramIdx++}`); params.push(parseFloat(max_amount)); }
    if (date_from) { conditions.push(`t.date >= $${paramIdx++}`); params.push(date_from); }
    if (date_to) { conditions.push(`t.date <= $${paramIdx++}`); params.push(date_to); }
    if (search) {
      conditions.push(`(t.description ILIKE $${paramIdx} OR t.merchant ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    const where = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM transactions t WHERE ${where}`,
      params
    );

    params.push(l, offset);
    const result = await db.query(
      `SELECT t.transaction_id, t.user_id, u.name AS user_name, u.email AS user_email,
              t.description, t.merchant, t.amount, t.type, t.date, t.status, t.source,
              t.ml_confidence, c.name AS category_name, t.created_at
       FROM transactions t
       JOIN users u ON u.user_id = t.user_id
       LEFT JOIN categories c ON c.category_id = t.category_id
       WHERE ${where}
       ORDER BY t.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    res.json({
      transactions: result.rows,
      ...buildPaginationMeta(countResult.rows[0].total, p, l),
    });
  } catch (err) {
    console.error('listTransactions error:', err);
    res.status(500).json({ error: 'Failed to list transactions' });
  }
};

// ── GET /admin/transactions/:id ────────────────────────────────────────────

const getTransactionDetail = async (req, res) => {
  try {
    const txnId = parseInt(req.params.id);
    if (!txnId) return res.status(400).json({ error: 'Invalid transaction ID' });

    const result = await db.query(
      `SELECT t.transaction_id, t.user_id, u.name AS user_name, u.email AS user_email,
              t.description, t.merchant, t.amount, t.type, t.date, t.status, t.source,
              t.ml_confidence, t.notes, t.created_at, t.updated_at,
              c.category_id, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
       FROM transactions t
       JOIN users u ON u.user_id = t.user_id
       LEFT JOIN categories c ON c.category_id = t.category_id
       WHERE t.transaction_id = $1
       LIMIT 1`,
      [txnId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

    res.json({ transaction: result.rows[0] });
  } catch (err) {
    console.error('getTransactionDetail error:', err);
    res.status(500).json({ error: 'Failed to load transaction detail' });
  }
};

// ── PATCH /admin/transactions/:id/category ─────────────────────────────────

const patchTransactionCategory = async (req, res) => {
  try {
    const txnId = parseInt(req.params.id);
    if (!txnId) return res.status(400).json({ error: 'Invalid transaction ID' });

    const { category_id } = req.body;
    if (!category_id || !Number.isInteger(category_id) || category_id <= 0) {
      return res.status(400).json({ error: 'Valid category_id required' });
    }

    const catResult = await db.query(`SELECT category_id FROM categories WHERE category_id = $1`, [category_id]);
    if (catResult.rows.length === 0) return res.status(400).json({ error: 'Invalid category' });

    const updateResult = await db.query(
      `UPDATE transactions SET category_id = $1, updated_at = NOW() WHERE transaction_id = $2 RETURNING transaction_id`,
      [category_id, txnId]
    );

    if (updateResult.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });

    // Log feedback event for learning loop
    const txnResult = await db.query(`SELECT user_id, description, merchant, amount FROM transactions WHERE transaction_id = $1`, [txnId]);
    if (txnResult.rows.length > 0) {
      await db.query(
        `INSERT INTO category_feedback_events
           (user_id, transaction_id, feedback_kind, signal_type, final_category_id, final_category_name,
            merchant, description, amount, metadata)
         VALUES ($1, $2, 'admin_correction', 'correction', $3, $4, $5, $6, $7, $8)`,
        [
          txnResult.rows[0].user_id, txnId,
          category_id, catResult.rows[0].name,
          txnResult.rows[0].merchant, txnResult.rows[0].description,
          txnResult.rows[0].amount,
          JSON.stringify({ admin_user_id: req.userId, corrected_at: new Date().toISOString() }),
        ]
      );
    }

    await writeAdminAuditLog({
      actorUserId: req.userId, actorEmail: req.userEmail,
      action: 'patch_transaction_category', resourceType: 'transaction', resourceId: String(txnId),
      ipAddress: getClientIp(req), userAgent: req.headers['user-agent'],
      requestPayload: { category_id }, responseStatus: 200,
    });

    res.json({ message: 'Category updated successfully' });
  } catch (err) {
    console.error('patchTransactionCategory error:', err);
    res.status(500).json({ error: 'Failed to update transaction category' });
  }
};

// ── GET /admin/import-sessions ─────────────────────────────────────────────

const listImportSessions = async (req, res) => {
  try {
    const { user_id, state, source_bank, page = 1, limit = 50 } = req.query;
    const { offset, page: p, limit: l } = paginate(page, limit);

    const conditions = ['1=1'];
    const params = [];
    let paramIdx = 1;

    if (user_id) { conditions.push(`i.user_id = $${paramIdx++}`); params.push(parseInt(user_id)); }
    if (state) { conditions.push(`i.state = $${paramIdx++}`); params.push(state); }
    if (source_bank) { conditions.push(`i.source_bank ILIKE $${paramIdx++}`); params.push(`%${source_bank}%`); }

    const where = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM import_sessions i WHERE ${where}`,
      params
    );

    params.push(l, offset);
    const result = await db.query(
      `SELECT i.import_session_id, i.user_id, u.name AS user_name, u.email AS user_email,
              i.file_name, i.source_type, i.source_bank, i.parser_name, i.state,
              i.detection_confidence, i.warnings, i.created_at,
              (SELECT COUNT(*) FROM import_session_rows r WHERE r.import_session_id = i.import_session_id) AS total_rows,
              (SELECT COUNT(*) FROM import_session_rows r WHERE r.import_session_id = i.import_session_id AND r.is_excluded = false AND r.needs_review = false) AS accepted_rows,
              (SELECT COUNT(*) FROM import_session_rows r WHERE r.import_session_id = i.import_session_id AND r.needs_review = true) AS needs_review_rows
       FROM import_sessions i
       JOIN users u ON u.user_id = i.user_id
       WHERE ${where}
       ORDER BY i.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    res.json({
      sessions: result.rows,
      ...buildPaginationMeta(countResult.rows[0].total, p, l),
    });
  } catch (err) {
    console.error('listImportSessions error:', err);
    res.status(500).json({ error: 'Failed to list import sessions' });
  }
};

// ── GET /admin/import-sessions/:id ─────────────────────────────────────────

const getImportSessionDetail = async (req, res) => {
  try {
    const sessionId = req.params.id;
    if (!sessionId) return res.status(400).json({ error: 'Invalid session ID' });

    const result = await db.query(
      `SELECT i.import_session_id, i.user_id, u.name AS user_name, u.email AS user_email,
              i.file_name, i.mime_type, i.source_type, i.source_bank, i.parser_name,
              i.detection_confidence, i.state, i.warnings, i.summary, i.created_at, i.updated_at
       FROM import_sessions i
       JOIN users u ON u.user_id = i.user_id
       WHERE i.import_session_id = $1
       LIMIT 1`,
      [sessionId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Import session not found' });

    const rowsResult = await db.query(
      `SELECT row_index, raw_payload, normalized_payload, extraction_confidence,
              needs_review, dedupe_status, duplicate_reason, top_predictions, is_excluded, created_at
       FROM import_session_rows
       WHERE import_session_id = $1
       ORDER BY row_index ASC`,
      [sessionId]
    );

    res.json({
      session: result.rows[0],
      rows: rowsResult.rows,
    });
  } catch (err) {
    console.error('getImportSessionDetail error:', err);
    res.status(500).json({ error: 'Failed to load import session detail' });
  }
};

// ── GET /admin/import-sessions/:id/rows ────────────────────────────────────

const getImportSessionRows = async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { needs_review, page = 1, limit = 100 } = req.query;
    const { offset, page: p, limit: l } = paginate(page, limit);

    const conditions = ['import_session_id = $1'];
    const params = [sessionId];

    if (needs_review !== undefined) {
      conditions.push(`needs_review = $2`);
      params.push(needs_review === 'true' || needs_review === true);
    }

    const where = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM import_session_rows WHERE ${where}`,
      params
    );

    params.push(l, offset);
    const result = await db.query(
      `SELECT row_index, description, merchant, amount, direction, type,
              needs_review, dedupe_status, duplicate_reason, top_predictions, is_excluded,
              extraction_confidence, created_at
       FROM import_session_rows
       WHERE ${where}
       ORDER BY row_index ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      rows: result.rows,
      ...buildPaginationMeta(countResult.rows[0].total, p, l),
    });
  } catch (err) {
    console.error('getImportSessionRows error:', err);
    res.status(500).json({ error: 'Failed to load import rows' });
  }
};

// ── GET /admin/categorization-review ──────────────────────────────────────

const listCategorizationReview = async (req, res) => {
  try {
    const { user_id, days = 30, page = 1, limit = 100 } = req.query;
    const { offset, page: p, limit: l } = paginate(page, limit);

    const conditions = [
      `feedback_kind IN ('explicit_correction', 'admin_correction')`,
      `created_at > NOW() - INTERVAL '${parseInt(days)} days'`,
    ];
    const params = [];
    let paramIdx = 1;

    if (user_id) {
      conditions.push(`e.user_id = $${paramIdx++}`);
      params.push(parseInt(user_id));
    }

    const where = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM category_feedback_events e WHERE ${where}`,
      params
    );

    params.push(l, offset);
    const result = await db.query(
      `SELECT e.feedback_event_id, e.user_id, u.name AS user_name, e.feedback_kind,
              e.merchant, e.predicted_category_name, e.final_category_name,
              e.predicted_confidence, e.amount, e.direction, e.model_version,
              e.created_at, e.transaction_id, e.import_session_id, e.row_index
       FROM category_feedback_events e
       JOIN users u ON u.user_id = e.user_id
       WHERE ${where}
       ORDER BY e.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    res.json({
      events: result.rows,
      ...buildPaginationMeta(countResult.rows[0].total, p, l),
    });
  } catch (err) {
    console.error('listCategorizationReview error:', err);
    res.status(500).json({ error: 'Failed to list categorization review' });
  }
};

// ── POST /admin/categorization-review/:id/approve ─────────────────────────

const approveCategorization = async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

    // Mark event as approved / confirmed
    await db.query(
      `UPDATE category_feedback_events
       SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{admin_approved}', 'true'),
           event_hash = COALESCE(event_hash, md5(random()::text))
       WHERE feedback_event_id = $1`,
      [eventId]
    );

    await writeAdminAuditLog({
      actorUserId: req.userId, actorEmail: req.userEmail,
      action: 'approve_categorization', resourceType: 'feedback_event', resourceId: String(eventId),
      ipAddress: getClientIp(req), userAgent: req.headers['user-agent'],
      requestPayload: null, responseStatus: 200,
    });

    res.json({ message: 'Categorization approved' });
  } catch (err) {
    console.error('approveCategorization error:', err);
    res.status(500).json({ error: 'Failed to approve categorization' });
  }
};

// ── POST /admin/categorization-review/:id/correct ─────────────────────────

const correctCategorization = async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    if (!eventId) return res.status(400).json({ error: 'Invalid event ID' });

    const { category_id } = req.body;
    if (!category_id || !Number.isInteger(category_id)) {
      return res.status(400).json({ error: 'Valid category_id required' });
    }

    const catResult = await db.query(`SELECT name FROM categories WHERE category_id = $1`, [category_id]);
    if (catResult.rows.length === 0) return res.status(400).json({ error: 'Invalid category' });

    await db.query(
      `UPDATE category_feedback_events
       SET final_category_id = $1, final_category_name = $2,
           metadata = jsonb_set(COALESCE(metadata, '{}'), '{admin_corrected_at}', $3::jsonb)
       WHERE feedback_event_id = $4`,
      [category_id, catResult.rows[0].name, JSON.stringify(new Date().toISOString()), eventId]
    );

    // If this event has a transaction, update it
    const eventResult = await db.query(
      `SELECT transaction_id, user_id, final_category_name FROM category_feedback_events WHERE feedback_event_id = $1`,
      [eventId]
    );
    if (eventResult.rows[0]?.transaction_id) {
      await db.query(
        `UPDATE transactions SET category_id = $1, updated_at = NOW() WHERE transaction_id = $2`,
        [category_id, eventResult.rows[0].transaction_id]
      );
    }

    await writeAdminAuditLog({
      actorUserId: req.userId, actorEmail: req.userEmail,
      action: 'correct_categorization', resourceType: 'feedback_event', resourceId: String(eventId),
      ipAddress: getClientIp(req), userAgent: req.headers['user-agent'],
      requestPayload: { category_id }, responseStatus: 200,
    });

    res.json({ message: 'Category corrected successfully' });
  } catch (err) {
    console.error('correctCategorization error:', err);
    res.status(500).json({ error: 'Failed to correct categorization' });
  }
};

// ── GET /admin/budgets-goals ───────────────────────────────────────────────

const getBudgetsGoals = async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const { offset, page: p, limit: l } = paginate(page, limit);

    const [
      budgetCountResult,
      activeGoalCountResult,
      overBudgetResult,
      avgSavingsResult,
      budgetsResult,
    ] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS total_budgets FROM budgets`),
      db.query(`SELECT COUNT(*)::int AS active_goals FROM goals WHERE status = 'active'`),
      db.query(`
        SELECT COUNT(DISTINCT b.user_id)::int AS over_budget_users
        FROM budgets b
        JOIN transactions t ON t.user_id = b.user_id
          AND t.type = 'expense'
          AND EXTRACT(MONTH FROM t.date) = b.month
          AND EXTRACT(YEAR FROM t.date) = b.year
        WHERE (SELECT COALESCE(SUM(t2.amount), 0) FROM transactions t2
               WHERE t2.user_id = b.user_id AND t2.type = 'expense'
                 AND EXTRACT(MONTH FROM t2.date) = b.month
                 AND EXTRACT(YEAR FROM t2.date) = b.year
                 AND t2.category_id = b.category_id) > b.monthly_limit
        GROUP BY b.user_id
      `),
      db.query(`
        SELECT
          COUNT(DISTINCT u.user_id)::int AS users_with_data,
          COALESCE(AVG(
            CASE WHEN (SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) FROM transactions WHERE user_id = u.user_id) > 0
            THEN (
              (SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) FROM transactions WHERE user_id = u.user_id) -
              (SELECT SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) FROM transactions WHERE user_id = u.user_id)
            ) /
            NULLIF((SELECT SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) FROM transactions WHERE user_id = u.user_id), 0)
            * 100
            ELSE NULL END
          ), 0)::decimal AS avg_savings_rate
        FROM users u
      `),
      db.query(`
        SELECT b.budget_id, b.user_id, u.name AS user_name, b.category_id,
               c.name AS category_name, b.monthly_limit, b.month, b.year,
               (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
                WHERE t.user_id = b.user_id AND t.category_id = b.category_id
                  AND t.type = 'expense'
                  AND EXTRACT(MONTH FROM t.date) = b.month
                  AND EXTRACT(YEAR FROM t.date) = b.year) AS spent,
               ROUND((SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
                WHERE t.user_id = b.user_id AND t.category_id = b.category_id
                  AND t.type = 'expense'
                  AND EXTRACT(MONTH FROM t.date) = b.month
                  AND EXTRACT(YEAR FROM t.date) = b.year) / NULLIF(b.monthly_limit, 0) * 100, 1) AS utilization_pct
        FROM budgets b
        JOIN users u ON u.user_id = b.user_id
        JOIN categories c ON c.category_id = b.category_id
        ORDER BY b.year DESC, b.month DESC
        LIMIT $1 OFFSET $2
      `, [l, offset]),
    ]);

    const overBudgetCount = overBudgetResult.rows[0]?.over_budget_users || 0;
    const avgSavings = parseFloat(avgSavingsResult.rows[0]?.avg_savings_rate || 0);

    res.json({
      summary: {
        total_budgets: budgetCountResult.rows[0].total_budgets,
        active_goals: activeGoalCountResult.rows[0].active_goals,
        over_budget_users: overBudgetCount,
        avg_savings_rate: avgSavings.toFixed(1),
      },
      budgets: budgetsResult.rows,
      ...buildPaginationMeta(budgetCountResult.rows[0].total_budgets, p, l),
    });
  } catch (err) {
    console.error('getBudgetsGoals error:', err);
    res.status(500).json({ error: 'Failed to load budgets and goals' });
  }
};

// ── GET /admin/forecasting ─────────────────────────────────────────────────

const getForecasting = async (req, res) => {
  try {
    const { user_id, months = 3, page = 1, limit = 50 } = req.query;
    const { offset, page: p, limit: l } = paginate(page, limit);

    // Check ML service health first
    let mlStatus = 'unknown';
    try {
      const mlResponse = await Promise.race([
        fetch(`${ML_SERVICE_URL}/health`),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ML_TIMEOUT_MS)),
      ]);
      mlStatus = mlResponse?.ok ? 'available' : 'degraded';
    } catch {
      mlStatus = 'offline';
    }

    const conditions = ['1=1'];
    const params = [];
    let paramIdx = 1;

    if (user_id) {
      conditions.push(`u.user_id = $${paramIdx++}`);
      params.push(parseInt(user_id));
    }

    const where = conditions.join(' AND ');

    // Get users with forecast history (transaction aggregates)
    const countResult = await db.query(
      `SELECT COUNT(DISTINCT u.user_id)::int AS total FROM users u WHERE ${where}`,
      params
    );

    params.push(l, offset);
    const usersResult = await db.query(
      `SELECT u.user_id, u.name, u.monthly_income,
              (SELECT COUNT(DISTINCT DATE_TRUNC('month', t.date))::int FROM transactions t WHERE t.user_id = u.user_id) AS months_of_history,
              (SELECT COUNT(*)::int FROM transactions t WHERE t.user_id = u.user_id) AS transaction_count
       FROM users u
       WHERE ${where}
       ORDER BY u.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    // Aggregate monthly totals per user for forecast context
    const monthlyTotals = await db.query(`
      SELECT t.user_id,
             EXTRACT(YEAR FROM t.date)::int AS year,
             EXTRACT(MONTH FROM t.date)::int AS month,
             SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END)::decimal AS total_income,
             SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END)::decimal AS total_expenses
      FROM transactions t
      GROUP BY t.user_id, EXTRACT(YEAR FROM t.date), EXTRACT(MONTH FROM t.date)
      ORDER BY t.user_id, year DESC, month DESC
    `);

    res.json({
      ml_service_status: mlStatus,
      users: usersResult.rows,
      monthly_aggregates: monthlyTotals.rows,
      ...buildPaginationMeta(countResult.rows[0].total, p, l),
    });
  } catch (err) {
    console.error('getForecasting error:', err);
    res.status(500).json({ error: 'Failed to load forecasting data' });
  }
};

// ── GET /admin/anomalies ───────────────────────────────────────────────────

const listAnomalies = async (req, res) => {
  try {
    const { user_id, severity, status, page = 1, limit = 100 } = req.query;
    const { offset, page: p, limit: l } = paginate(page, limit);

    const conditions = ['1=1'];
    const params = [];
    let paramIdx = 1;

    if (user_id) { conditions.push(`a.user_id = $${paramIdx++}`); params.push(parseInt(user_id)); }
    if (severity) { conditions.push(`a.severity = $${paramIdx++}`); params.push(severity); }
    if (status) { conditions.push(`a.status = $${paramIdx++}`); params.push(status); }

    const where = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM anomalies a WHERE ${where}`,
      params
    );

    const summaryResult = await db.query(`
      SELECT
        COUNT(*)::int FILTER (WHERE status = 'active') AS active_total,
        COUNT(*)::int FILTER (WHERE severity = 'high' AND status = 'active') AS high_severity,
        COUNT(*)::int FILTER (WHERE severity = 'medium' AND status = 'active') AS medium_severity,
        COUNT(*)::int FILTER (WHERE severity = 'low' AND status = 'active') AS low_severity
      FROM anomalies
    `);

    params.push(l, offset);
    const result = await db.query(
      `SELECT a.anomaly_id, a.user_id, u.name AS user_name, a.anomaly_type, a.scope,
              a.severity, a.title, a.explanation, a.status, a.year, a.month,
              a.transaction_id, a.created_at, a.updated_at
       FROM anomalies a
       JOIN users u ON u.user_id = a.user_id
       WHERE ${where}
       ORDER BY a.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    res.json({
      anomalies: result.rows,
      summary: {
        active: summaryResult.rows[0].active_total,
        high: summaryResult.rows[0].high_severity,
        medium: summaryResult.rows[0].medium_severity,
        low: summaryResult.rows[0].low_severity,
      },
      ...buildPaginationMeta(countResult.rows[0].total, p, l),
    });
  } catch (err) {
    console.error('listAnomalies error:', err);
    res.status(500).json({ error: 'Failed to list anomalies' });
  }
};

// ── PATCH /admin/anomalies/:id/review ─────────────────────────────────────

const patchAnomalyStatus = async (req, res) => {
  try {
    const anomalyId = parseInt(req.params.id);
    if (!anomalyId) return res.status(400).json({ error: 'Invalid anomaly ID' });

    const { status: newStatus } = req.body;
    if (!newStatus || !['active', 'read', 'dismissed', 'resolved'].includes(newStatus)) {
      return res.status(400).json({ error: 'Valid status required (active|read|dismissed|resolved)' });
    }

    const result = await db.query(
      `UPDATE anomalies SET status = $1, updated_at = NOW() WHERE anomaly_id = $2 RETURNING anomaly_id`,
      [newStatus, anomalyId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Anomaly not found' });

    await writeAdminAuditLog({
      actorUserId: req.userId, actorEmail: req.userEmail,
      action: 'patch_anomaly_status', resourceType: 'anomaly', resourceId: String(anomalyId),
      ipAddress: getClientIp(req), userAgent: req.headers['user-agent'],
      requestPayload: { status: newStatus }, responseStatus: 200,
    });

    res.json({ message: 'Anomaly status updated' });
  } catch (err) {
    console.error('patchAnomalyStatus error:', err);
    res.status(500).json({ error: 'Failed to update anomaly status' });
  }
};

// ── GET /admin/ai-logs ─────────────────────────────────────────────────────

const listAiLogs = async (req, res) => {
  try {
    const { user_id, channel, page = 1, limit = 100 } = req.query;
    const { offset, page: p, limit: l } = paginate(page, limit);

    const conditions = ['1=1'];
    const params = [];
    let paramIdx = 1;

    if (user_id) { conditions.push(`a.user_id = $${paramIdx++}`); params.push(parseInt(user_id)); }
    if (channel) { conditions.push(`a.channel = $${paramIdx++}`); params.push(channel); }

    const where = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM ai_logs a WHERE ${where}`,
      params
    );

    params.push(l, offset);
    const result = await db.query(
      `SELECT a.log_id, a.user_id, u.name AS user_name, u.email AS user_email,
              a.input_text, a.response_text, a.channel, a.created_at
       FROM ai_logs a
       JOIN users u ON u.user_id = a.user_id
       WHERE ${where}
       ORDER BY a.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    res.json({
      logs: result.rows,
      ...buildPaginationMeta(countResult.rows[0].total, p, l),
    });
  } catch (err) {
    console.error('listAiLogs error:', err);
    res.status(500).json({ error: 'Failed to list AI logs' });
  }
};

// ── GET /admin/voice-logs ──────────────────────────────────────────────────

const listVoiceLogs = async (req, res) => {
  try {
    const { user_id, page = 1, limit = 100 } = req.query;
    const { offset, page: p, limit: l } = paginate(page, limit);

    const conditions = [`a.channel = 'voice'`];
    const params = [];
    let paramIdx = 1;

    if (user_id) { conditions.push(`a.user_id = $${paramIdx++}`); params.push(parseInt(user_id)); }

    const where = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM ai_logs a WHERE ${where}`,
      params
    );

    params.push(l, offset);
    const result = await db.query(
      `SELECT a.log_id, a.user_id, u.name AS user_name, u.email AS user_email,
              a.input_text, a.response_text, a.channel, a.created_at
       FROM ai_logs a
       JOIN users u ON u.user_id = a.user_id
       WHERE ${where}
       ORDER BY a.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    res.json({
      logs: result.rows,
      ...buildPaginationMeta(countResult.rows[0].total, p, l),
    });
  } catch (err) {
    console.error('listVoiceLogs error:', err);
    res.status(500).json({ error: 'Failed to list voice logs' });
  }
};

// ── GET /admin/support ─────────────────────────────────────────────────────

const listSupport = async (req, res) => {
  try {
    const { user_id, status, page = 1, limit = 50 } = req.query;
    const { offset, page: p, limit: l } = paginate(page, limit);

    const conditions = ['1=1'];
    const params = [];
    let paramIdx = 1;

    if (user_id) { conditions.push(`s.user_id = $${paramIdx++}`); params.push(parseInt(user_id)); }
    if (status) { conditions.push(`s.status = $${paramIdx++}`); params.push(status); }

    const where = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM support_requests s WHERE ${where}`,
      params
    );

    const summaryResult = await db.query(`
      SELECT
        COUNT(*)::int FILTER (WHERE status = 'open') AS open_count,
        COUNT(*)::int FILTER (WHERE status = 'in_progress') AS in_progress_count,
        COUNT(*)::int FILTER (WHERE status = 'resolved') AS resolved_count
      FROM support_requests
    `);

    params.push(l, offset);
    const result = await db.query(
      `SELECT s.support_request_id, s.user_id, u.name AS user_name, u.email AS user_email,
              s.subject, s.message, s.status, s.created_at
       FROM support_requests s
       JOIN users u ON u.user_id = s.user_id
       WHERE ${where}
       ORDER BY s.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    res.json({
      requests: result.rows,
      summary: {
        open: summaryResult.rows[0].open_count,
        in_progress: summaryResult.rows[0].in_progress_count,
        resolved: summaryResult.rows[0].resolved_count,
      },
      ...buildPaginationMeta(countResult.rows[0].total, p, l),
    });
  } catch (err) {
    console.error('listSupport error:', err);
    res.status(500).json({ error: 'Failed to list support requests' });
  }
};

// ── GET /admin/support/:id ─────────────────────────────────────────────────

const getSupportDetail = async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    if (!ticketId) return res.status(400).json({ error: 'Invalid ticket ID' });

    const result = await db.query(
      `SELECT s.support_request_id, s.user_id, u.name AS user_name, u.email AS user_email,
              s.subject, s.message, s.status, s.created_at
       FROM support_requests s
       JOIN users u ON u.user_id = s.user_id
       WHERE s.support_request_id = $1
       LIMIT 1`,
      [ticketId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Support request not found' });

    res.json({ request: result.rows[0] });
  } catch (err) {
    console.error('getSupportDetail error:', err);
    res.status(500).json({ error: 'Failed to load support detail' });
  }
};

// ── PATCH /admin/support/:id ───────────────────────────────────────────────

const patchSupport = async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    if (!ticketId) return res.status(400).json({ error: 'Invalid ticket ID' });

    const { status: newStatus, admin_note } = req.body;
    if (!newStatus || !['open', 'in_progress', 'resolved'].includes(newStatus)) {
      return res.status(400).json({ error: 'Valid status required (open|in_progress|resolved)' });
    }

    const result = await db.query(
      `UPDATE support_requests SET status = $1 WHERE support_request_id = $2 RETURNING support_request_id`,
      [newStatus, ticketId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Support request not found' });

    await writeAdminAuditLog({
      actorUserId: req.userId, actorEmail: req.userEmail,
      action: 'patch_support_status', resourceType: 'support_request', resourceId: String(ticketId),
      ipAddress: getClientIp(req), userAgent: req.headers['user-agent'],
      requestPayload: { status: newStatus, admin_note }, responseStatus: 200,
    });

    res.json({ message: 'Support request updated' });
  } catch (err) {
    console.error('patchSupport error:', err);
    res.status(500).json({ error: 'Failed to update support request' });
  }
};

// ── GET /admin/ml-health ───────────────────────────────────────────────────

const getMlHealth = async (req, res) => {
  const results = {};
  const endpoints = [
    { name: 'categorize', path: '/ml/categorize', method: 'POST' },
    { name: 'categorize_batch', path: '/ml/categorize/batch', method: 'POST' },
    { name: 'forecast', path: '/ml/forecast/personalized', method: 'POST' },
    { name: 'extract_statement', path: '/ml/extract/statement', method: 'POST' },
  ];

  await Promise.allSettled(
    endpoints.map(async ({ name, path, method }) => {
      const start = Date.now();
      try {
        const signal = AbortSignal.timeout(ML_TIMEOUT_MS);
        const response = await fetch(`${ML_SERVICE_URL}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(method === 'POST' && !path.includes('categorize') && !path.includes('forecast') && !path.includes('extract')
            ? {} : {}),
          signal,
        });
        const latency = Date.now() - start;
        results[name] = {
          status: response.ok ? 'ok' : 'error',
          status_code: response.status,
          latency_ms: latency,
          last_check: new Date().toISOString(),
        };
      } catch (err) {
        results[name] = {
          status: 'offline',
          latency_ms: null,
          error: err.message,
          last_check: new Date().toISOString(),
        };
      }
    })
  );

  const overallStatus = Object.values(results).every(r => r.status === 'ok')
    ? 'ok'
    : Object.values(results).some(r => r.status === 'ok')
      ? 'degraded'
      : 'offline';

  res.json({ status: overallStatus, endpoints: results });
};

// ── GET /admin/system-health ───────────────────────────────────────────────

const getSystemHealth = async (req, res) => {
  try {
    // DB ping
    const dbStart = Date.now();
    const dbResult = await db.query('SELECT 1 AS ping');
    const dbPing = Date.now() - dbStart;

    // ML probe
    let mlStatus = 'unknown';
    let mlLatency = null;
    try {
      const mlStart = Date.now();
      const mlResponse = await Promise.race([
        fetch(`${ML_SERVICE_URL}/health`),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ML_TIMEOUT_MS)),
      ]);
      mlLatency = Date.now() - mlStart;
      mlStatus = mlResponse?.ok ? 'ok' : 'degraded';
    } catch {
      mlStatus = 'offline';
    }

    // Env var sanity (no secrets exposed)
    const envSanity = {
      ML_SERVICE_URL: !!process.env.ML_SERVICE_URL,
      ECOMAGENT_API_KEY: !!process.env.ECOMAGENT_API_KEY,
      JWT_SECRET: !!process.env.JWT_SECRET,
      DB_HOST: !!process.env.DB_HOST,
    };

    // Uptime (process uptime in seconds)
    const uptimeSeconds = Math.floor(process.uptime());

    // Server time
    const serverTime = new Date().toISOString();

    res.json({
      backend: { status: 'ok', uptime_s: uptimeSeconds, db_ping_ms: dbPing, version: '1.0.0' },
      db: {
        status: 'ok',
        connection_count: dbResult.rows[0]?.ping ? 1 : 0,
      },
      ml: { status: mlStatus, latency_ms: mlLatency },
      env_sanity: envSanity,
      server_time: serverTime,
      node_version: process.version,
    });
  } catch (err) {
    console.error('getSystemHealth error:', err);
    res.status(500).json({ error: 'Failed to check system health' });
  }
};

// ── GET /admin/audit-logs ──────────────────────────────────────────────────

const listAuditLogs = async (req, res) => {
  try {
    const {
      actor_user_id, action, resource_type,
      date_from, date_to, page = 1, limit = 100,
    } = req.query;
    const { offset, page: p, limit: l } = paginate(page, limit);

    const conditions = ['1=1'];
    const params = [];
    let paramIdx = 1;

    if (actor_user_id) { conditions.push(`a.actor_user_id = $${paramIdx++}`); params.push(parseInt(actor_user_id)); }
    if (action) { conditions.push(`a.action ILIKE $${paramIdx++}`); params.push(`%${action}%`); }
    if (resource_type) { conditions.push(`a.resource_type = $${paramIdx++}`); params.push(resource_type); }
    if (date_from) { conditions.push(`a.created_at >= $${paramIdx++}`); params.push(date_from); }
    if (date_to) { conditions.push(`a.created_at <= $${paramIdx++}`); params.push(date_to); }

    const where = conditions.join(' AND ');

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM admin_audit_logs a WHERE ${where}`,
      params
    );

    params.push(l, offset);
    const result = await db.query(
      `SELECT a.audit_log_id, a.actor_user_id, a.actor_email, a.action, a.resource_type,
              a.resource_id, a.ip_address, a.user_agent, a.response_status, a.created_at
       FROM admin_audit_logs a
       WHERE ${where}
       ORDER BY a.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    res.json({
      logs: result.rows,
      ...buildPaginationMeta(countResult.rows[0].total, p, l),
    });
  } catch (err) {
    console.error('listAuditLogs error:', err);
    res.status(500).json({ error: 'Failed to list audit logs' });
  }
};

module.exports = {
  getOverview,
  listUsers,
  getUserDetail,
  patchUser,
  listTransactions,
  getTransactionDetail,
  patchTransactionCategory,
  listImportSessions,
  getImportSessionDetail,
  getImportSessionRows,
  listCategorizationReview,
  approveCategorization,
  correctCategorization,
  getBudgetsGoals,
  getForecasting,
  listAnomalies,
  patchAnomalyStatus,
  listAiLogs,
  listVoiceLogs,
  listSupport,
  getSupportDetail,
  patchSupport,
  getMlHealth,
  getSystemHealth,
  listAuditLogs,
};