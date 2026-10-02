const jwt = require('jsonwebtoken');
const db = require('../db/db');

const shouldEnforceTokenVersion = () => {
  const raw = String(process.env.AUTH_ENFORCE_TOKEN_VERSION || 'true').trim().toLowerCase();
  return raw !== 'false';
};

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Access denied.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !Number.isInteger(Number(decoded.userId))) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const userId = Number(decoded.userId);
    const tokenVersion = Number.isInteger(decoded.tokenVersion) ? decoded.tokenVersion : 0;

    req.userId = userId;
    req.userEmail = decoded.email;
    req.tokenVersion = tokenVersion;

    if (!shouldEnforceTokenVersion()) {
      return next();
    }

    const userResult = await db.query(
      `SELECT token_version
       FROM users
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const currentTokenVersion = Number(userResult.rows[0].token_version || 0);

    if (currentTokenVersion !== tokenVersion) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;