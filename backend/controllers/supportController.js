const db = require('../db/db');

const createSupportRequest = async (req, res) => {
  const userId = req.userId;
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

  if (!subject || !message) {
    return res.status(400).json({ error: 'subject and message are required' });
  }

  if (subject.length > 200) {
    return res.status(400).json({ error: 'subject must be 200 characters or less' });
  }

  try {
    await db.query(
      `INSERT INTO support_requests (user_id, subject, message)
       VALUES ($1, $2, $3)`,
      [userId, subject, message]
    );

    return res.status(201).json({ message: 'Support request submitted' });
  } catch (err) {
    console.error('createSupportRequest error:', err.message);
    return res.status(500).json({ error: 'Server error submitting support request' });
  }
};

module.exports = { createSupportRequest };
