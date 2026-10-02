const db = require('../../db/db');
const { logServiceEvent } = require('../observability/eventLogger');

/**
 * Writes an admin audit log entry to the DB + emits structured event to stdout.
 * @param {object} opts
 * @param {number|null} opts.actorUserId
 * @param {string|null} opts.actorEmail
 * @param {string} opts.action
 * @param {string} opts.resourceType
 * @param {string|null} opts.resourceId
 * @param {string|null} opts.ipAddress
 * @param {string|null} opts.userAgent
 * @param {object|null} opts.requestPayload
 * @param {number|null} opts.responseStatus
 */
const writeAdminAuditLog = async ({
  actorUserId,
  actorEmail,
  action,
  resourceType,
  resourceId,
  ipAddress,
  userAgent,
  requestPayload,
  responseStatus,
}) => {
  try {
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

    logServiceEvent({
      service: 'admin.audit',
      operation: action,
      status: responseStatus && responseStatus >= 400 ? 'error' : 'ok',
      userId: actorUserId,
      details: { resource_type: resourceType, resource_id: resourceId },
    });
  } catch (err) {
    // Non-blocking - audit failure never blocks the request
    console.error('Admin audit log write failed:', err.message);
  }
};

module.exports = { writeAdminAuditLog };