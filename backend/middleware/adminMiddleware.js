const db = require('../db/db');

// 60-second cache for role lookups to avoid per-request DB hit
const roleCache = new Map(); // userId -> { role, expiresAt }
const ROLE_CACHE_TTL_MS = 60 * 1000;

const getCachedRole = (userId) => {
  const entry = roleCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    roleCache.delete(userId);
    return null;
  }
  return entry.role;
};

const setCachedRole = (userId, role) => {
  roleCache.set(userId, { role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
};

// Invalidate role cache (called after role/status changes)
const invalidateRoleCache = (userId) => {
  roleCache.delete(userId);
};

const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    null
  );
};

const requireAdmin = async (req, res, next) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const cachedRole = getCachedRole(req.userId);
  if (cachedRole) {
    if (cachedRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.isAdmin = true;
    return next();
  }

  try {
    const result = await db.query(
      `SELECT role FROM users WHERE user_id = $1 LIMIT 1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const role = result.rows[0].role || 'user';
    setCachedRole(req.userId, role);

    if (role !== 'admin') {
      // Log denial asynchronously - don't block response
      writeAdminAuditLogSafe({
        actorUserId: req.userId,
        actorEmail: req.userEmail,
        action: 'admin_permission_denied',
        resourceType: 'admin',
        resourceId: null,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null,
        requestPayload: null,
        responseStatus: 403,
      });
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.isAdmin = true;
    return next();
  } catch (err) {
    console.error('requireAdmin error:', err.message);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

// Fire-and-forget audit log — never blocks the request
const writeAdminAuditLogSafe = (opts) => {
  process.nextTick(async () => {
    try {
      const {
        actorUserId, actorEmail, action, resourceType, resourceId,
        ipAddress, userAgent, requestPayload, responseStatus,
      } = opts;

      await db.query(
        `INSERT INTO admin_audit_logs
           (actor_user_id, actor_email, action, resource_type, resource_id,
            ip_address, user_agent, request_payload, response_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
        [
          actorUserId,
          actorEmail || null,
          action,
          resourceType,
          resourceId || null,
          ipAddress,
          userAgent,
          requestPayload ? JSON.stringify(requestPayload) : null,
          responseStatus || null,
        ]
      );
    } catch (err) {
      // Non-critical — just log to stderr
      console.error('Admin audit log write failed:', err.message);
    }
  });
};

module.exports = { requireAdmin, writeAdminAuditLogSafe, getClientIp, invalidateRoleCache };