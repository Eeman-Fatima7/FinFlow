const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('../db/db');
const {
  createOrReplaceDraftPlanFromUser,
  getOnboardingStatus,
} = require('../services/budgets/planWriteService');

const RESET_TOKEN_TTL_MINUTES = Math.min(Math.max(Number(process.env.RESET_TOKEN_TTL_MINUTES) || 30, 5), 120);
const RESET_EMAIL_FROM = process.env.RESET_EMAIL_FROM || process.env.SMTP_USER || 'no-reply@financeadvisor.local';
const RESET_LINK_BASE_URL = process.env.RESET_PASSWORD_URL_BASE || process.env.FRONTEND_URL || 'http://localhost:3000';
const USER_ENUMERATION_SAFE_MESSAGE = 'If that email exists in our system, password reset instructions have been sent.';

let smtpTransporter;

const getResetMailer = async () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);

  if (!host || !user || !pass) {
    return null;
  }

  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  return smtpTransporter;
};

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const createResetToken = () => crypto.randomBytes(32).toString('hex');

const buildResetLink = (token) => {
  const base = RESET_LINK_BASE_URL.endsWith('/') ? RESET_LINK_BASE_URL.slice(0, -1) : RESET_LINK_BASE_URL;
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
};

const sendPasswordResetEmail = async ({ email, name, token }) => {
  const transporter = await getResetMailer();

  if (!transporter) {
    return { delivered: false, reason: 'smtp_not_configured' };
  }

  const resetLink = buildResetLink(token);
  const displayName = name || 'there';

  await transporter.sendMail({
    from: RESET_EMAIL_FROM,
    to: email,
    subject: 'Reset your FinFlow password',
    text: `Hi ${displayName},\n\nWe received a request to reset your FinFlow password.\nUse this link within ${RESET_TOKEN_TTL_MINUTES} minutes:\n${resetLink}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hi ${displayName},</p><p>We received a request to reset your FinFlow password.</p><p>Use this link within <strong>${RESET_TOKEN_TTL_MINUTES} minutes</strong>:</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });

  return { delivered: true, reason: 'sent' };
};

const createSessionSafeResponse = () => ({
  message: 'If that email exists in our system, password reset instructions have been sent.',
});

const cleanupExpiredResetTokens = async () => {
  try {
    await db.query(
      `DELETE FROM password_reset_tokens
       WHERE expires_at < NOW() - INTERVAL '1 day'`
    );
  } catch (cleanupErr) {
    console.warn('Password reset token cleanup skipped:', cleanupErr.message);
  }
};

// ─── REGISTER ───────────────────────────────────────────────
const register = async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const city = typeof req.body?.city === 'string' ? req.body.city.trim() : '';
  const occupation = typeof req.body?.occupation === 'string' ? req.body.occupation.trim() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const bio = typeof req.body?.bio === 'string' ? req.body.bio.trim() : '';
  const avatarUrl = typeof req.body?.avatar_url === 'string' ? req.body.avatar_url.trim() : '';
  const monthlyIncomeInput = req.body?.monthly_income;

  // Basic validation
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  if (name.length > 100) {
    return res.status(400).json({ error: 'Name must be 100 characters or less' });
  }

  if (email.length > 150) {
    return res.status(400).json({ error: 'Email must be 150 characters or less' });
  }

  if (city.length > 100) {
    return res.status(400).json({ error: 'City must be 100 characters or less' });
  }

  if (occupation.length > 100) {
    return res.status(400).json({ error: 'Occupation must be 100 characters or less' });
  }

  if (phone.length > 30) {
    return res.status(400).json({ error: 'Phone must be 30 characters or less' });
  }

  if (bio.length > 2000) {
    return res.status(400).json({ error: 'Bio must be 2000 characters or less' });
  }

  const monthlyIncome =
    monthlyIncomeInput === undefined || monthlyIncomeInput === null || monthlyIncomeInput === ''
      ? 0
      : Number(monthlyIncomeInput);

  if (!Number.isFinite(monthlyIncome) || monthlyIncome < 0) {
    return res.status(400).json({ error: 'Monthly income must be a valid non-negative number' });
  }

  const normalizedCity = city || null;
  const normalizedOccupation = occupation || null;
  const normalizedPhone = phone || null;
  const normalizedBio = bio || null;
  const normalizedAvatarUrl = avatarUrl || null;

  try {
    // Check if email already exists
    const existing = await db.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash the password
    const salt           = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user
    const result = await db.query(
      `INSERT INTO users (name, email, password, monthly_income, city, occupation, phone, bio, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING user_id, name, email, monthly_income, city, occupation, phone, bio, avatar_url, preferred_theme, preferred_compact_mode, preferred_currency, preferred_date_format, preferred_language, created_at, token_version, role, status`,
      [name, email, hashedPassword, monthlyIncome, normalizedCity, normalizedOccupation, normalizedPhone, normalizedBio, normalizedAvatarUrl]
    );

    const user = result.rows[0];

    await db.query(
      `INSERT INTO user_notification_settings (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.user_id]
    );

    await db.query(
      `INSERT INTO user_security_settings (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.user_id]
    );

    await createOrReplaceDraftPlanFromUser({
      userId: user.user_id,
      source: 'signup',
      debtInput: {},
    });

    const onboarding = await getOnboardingStatus({ userId: user.user_id });

    // Sign JWT
    const token = jwt.sign(
      { userId: user.user_id, email: user.email, tokenVersion: user.token_version || 0 },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Account created successfully',
      token,
      user,
      onboarding,
    });

  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'Server error during registration' });
  }
};

// ─── LOGIN ───────────────────────────────────────────────────
const login = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (email.length > 150) {
    return res.status(400).json({ error: 'Email must be 150 characters or less' });
  }

  try {
    // Find user
    const result = await db.query(
      'SELECT user_id, name, email, password, monthly_income, city, occupation, phone, bio, avatar_url, preferred_theme, preferred_compact_mode, preferred_currency, preferred_date_format, preferred_language, created_at, token_version, role, status FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Sign JWT
    const token = jwt.sign(
      { userId: user.user_id, email: user.email, tokenVersion: user.token_version || 0 },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const onboarding = await getOnboardingStatus({ userId: user.user_id });

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        status: user.status || 'active',
        monthly_income: user.monthly_income,
        city: user.city,
        occupation: user.occupation,
        phone: user.phone,
        bio: user.bio,
        avatar_url: user.avatar_url,
        preferred_theme: user.preferred_theme,
        preferred_compact_mode: user.preferred_compact_mode,
        preferred_currency: user.preferred_currency,
        preferred_date_format: user.preferred_date_format,
        preferred_language: user.preferred_language,
        created_at: user.created_at,
      },
      onboarding,
    });

  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Server error during login' });
  }
};

// ─── GET ME (protected) ──────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT user_id, name, email, monthly_income, city, occupation, phone, bio, avatar_url,
              preferred_theme, preferred_compact_mode, preferred_currency, preferred_date_format,
              preferred_language, created_at, token_version, role, status
       FROM users WHERE user_id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if ((user.token_version || 0) !== (req.tokenVersion || 0)) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    const onboarding = await getOnboardingStatus({ userId: user.user_id });

    return res.status(200).json({
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        status: user.status || 'active',
        monthly_income: user.monthly_income,
        city: user.city,
        occupation: user.occupation,
        phone: user.phone,
        bio: user.bio,
        avatar_url: user.avatar_url,
        preferred_theme: user.preferred_theme,
        preferred_compact_mode: user.preferred_compact_mode,
        preferred_currency: user.preferred_currency,
        preferred_date_format: user.preferred_date_format,
        preferred_language: user.preferred_language,
        created_at: user.created_at,
      },
      onboarding,
    });

  } catch (err) {
    console.error('GetMe error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
};

const updateMe = async (req, res) => {
  const userId = req.userId;
  const {
    name,
    email,
    city,
    occupation,
    phone,
    bio,
    avatar_url: avatarUrl,
  } = req.body || {};

  const hasAvatarUrl = Object.prototype.hasOwnProperty.call(req.body || {}, 'avatar_url');

  const nextName = typeof name === 'string' ? name.trim() : undefined;
  const nextEmail = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
  const nextCity = city === null ? null : typeof city === 'string' ? city.trim() : undefined;
  const nextOccupation = occupation === null ? null : typeof occupation === 'string' ? occupation.trim() : undefined;
  const nextPhone = phone === null ? null : typeof phone === 'string' ? phone.trim() : undefined;
  const nextBio = bio === null ? null : typeof bio === 'string' ? bio.trim() : undefined;
  const nextAvatarUrl = hasAvatarUrl
    ? avatarUrl === null
      ? null
      : typeof avatarUrl === 'string'
        ? avatarUrl.trim()
        : undefined
    : undefined;

  if (
    nextName === undefined &&
    nextEmail === undefined &&
    nextCity === undefined &&
    nextOccupation === undefined &&
    nextPhone === undefined &&
    nextBio === undefined &&
    nextAvatarUrl === undefined
  ) {
    return res.status(400).json({ error: 'No supported fields provided for update' });
  }

  if (nextName !== undefined && !nextName) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }

  if (nextEmail !== undefined && !nextEmail) {
    return res.status(400).json({ error: 'email cannot be empty' });
  }

  if (nextName && nextName.length > 100) {
    return res.status(400).json({ error: 'Name must be 100 characters or less' });
  }

  if (nextEmail && nextEmail.length > 150) {
    return res.status(400).json({ error: 'Email must be 150 characters or less' });
  }

  if (typeof nextCity === 'string' && nextCity.length > 100) {
    return res.status(400).json({ error: 'City must be 100 characters or less' });
  }

  if (typeof nextOccupation === 'string' && nextOccupation.length > 100) {
    return res.status(400).json({ error: 'Occupation must be 100 characters or less' });
  }

  if (typeof nextPhone === 'string' && nextPhone.length > 30) {
    return res.status(400).json({ error: 'Phone must be 30 characters or less' });
  }

  if (typeof nextBio === 'string' && nextBio.length > 2000) {
    return res.status(400).json({ error: 'Bio must be 2000 characters or less' });
  }

  try {
    const currentResult = await db.query('SELECT * FROM users WHERE user_id = $1', [userId]);

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const current = currentResult.rows[0];

    const mergedName = nextName ?? current.name;
    const mergedEmail = nextEmail ?? current.email;
    const mergedCity = nextCity === undefined ? current.city : nextCity === null || nextCity === '' ? null : nextCity;
    const mergedOccupation = nextOccupation === undefined ? current.occupation : nextOccupation === null || nextOccupation === '' ? null : nextOccupation;
    const mergedPhone = nextPhone === undefined ? current.phone : nextPhone === null || nextPhone === '' ? null : nextPhone;
    const mergedBio = nextBio === undefined ? current.bio : nextBio === null || nextBio === '' ? null : nextBio;
    const mergedAvatarUrl = nextAvatarUrl === undefined ? current.avatar_url : nextAvatarUrl === null || nextAvatarUrl === '' ? null : nextAvatarUrl;

    const existing = await db.query(
      'SELECT user_id FROM users WHERE email = $1 AND user_id <> $2',
      [mergedEmail, userId]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const result = await db.query(
      `UPDATE users
       SET name = $1,
           email = $2,
           city = $3,
           occupation = $4,
           phone = $5,
           bio = $6,
           avatar_url = $7
       WHERE user_id = $8
       RETURNING user_id, name, email, monthly_income, city, occupation, phone, bio, avatar_url, preferred_theme, preferred_compact_mode, preferred_currency, preferred_date_format, preferred_language, created_at, token_version`,
      [mergedName, mergedEmail, mergedCity, mergedOccupation, mergedPhone, mergedBio, mergedAvatarUrl, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ message: 'Account updated', user: result.rows[0] });
  } catch (err) {
    console.error('updateMe error:', err.message);
    return res.status(500).json({ error: 'Server error updating account' });
  }
};

const changePassword = async (req, res) => {
  const userId = req.userId;
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const signOutOtherSessions = req.body?.signOutOtherSessions === true;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const result = await db.query('SELECT password FROM users WHERE user_id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const matches = await bcrypt.compare(currentPassword, user.password);

    if (!matches) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const incrementBy = signOutOtherSessions ? 2 : 1;

    const updated = await db.query(
      `UPDATE users
       SET password = $1,
           token_version = token_version + $2
       WHERE user_id = $3
       RETURNING token_version`,
      [hashedPassword, incrementBy, userId]
    );

    const nextToken = jwt.sign(
      {
        userId,
        email: req.userEmail,
        tokenVersion: updated.rows[0]?.token_version || 0,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'Password updated',
      token: nextToken,
      signedOutOtherSessions: signOutOtherSessions,
    });
  } catch (err) {
    console.error('changePassword error:', err.message);
    return res.status(500).json({ error: 'Server error updating password' });
  }
};

const deleteMe = async (req, res) => {
  const userId = req.userId;

  try {
    const result = await db.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING user_id',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ message: 'Account deleted' });
  } catch (err) {
    console.error('deleteMe error:', err.message);
    return res.status(500).json({ error: 'Server error deleting account' });
  }
};

const getPreferenceSettings = async (req, res) => {
  const userId = req.userId;

  try {
    const result = await db.query(
      `SELECT preferred_theme, preferred_compact_mode, preferred_currency, preferred_date_format, preferred_language
       FROM users
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = result.rows[0];

    return res.status(200).json({
      preferences: {
        theme: row.preferred_theme || 'system',
        compactMode: Boolean(row.preferred_compact_mode),
        currency: row.preferred_currency || 'USD',
        dateFormat: row.preferred_date_format || 'MM/DD/YYYY',
        language: row.preferred_language || 'en',
      },
    });
  } catch (err) {
    console.error('getPreferenceSettings error:', err.message);
    return res.status(500).json({ error: 'Server error fetching preferences' });
  }
};

const updatePreferenceSettings = async (req, res) => {
  const userId = req.userId;
  const preferences = req.body?.preferences;

  if (!preferences || typeof preferences !== 'object') {
    return res.status(400).json({ error: 'preferences object is required' });
  }

  const validThemes = new Set(['light', 'dark', 'system']);
  const validCurrencies = new Set(['USD', 'PKR', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'JPY']);
  const validDateFormats = new Set(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']);
  const validLanguages = new Set(['en', 'ur', 'es', 'fr', 'de', 'ja']);

  const nextTheme = typeof preferences.theme === 'string' ? preferences.theme : undefined;
  const nextCompactMode = typeof preferences.compactMode === 'boolean' ? preferences.compactMode : undefined;
  const nextCurrency = typeof preferences.currency === 'string' ? preferences.currency : undefined;
  const nextDateFormat = typeof preferences.dateFormat === 'string' ? preferences.dateFormat : undefined;
  const nextLanguage = typeof preferences.language === 'string' ? preferences.language : undefined;

  if (nextTheme && !validThemes.has(nextTheme)) {
    return res.status(400).json({ error: 'Invalid theme value' });
  }

  if (nextCurrency && !validCurrencies.has(nextCurrency)) {
    return res.status(400).json({ error: 'Invalid currency value' });
  }

  if (nextDateFormat && !validDateFormats.has(nextDateFormat)) {
    return res.status(400).json({ error: 'Invalid dateFormat value' });
  }

  if (nextLanguage && !validLanguages.has(nextLanguage)) {
    return res.status(400).json({ error: 'Invalid language value' });
  }

  try {
    const existing = await db.query(
      `SELECT preferred_theme, preferred_compact_mode, preferred_currency, preferred_date_format, preferred_language
       FROM users
       WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const current = existing.rows[0];

    const result = await db.query(
      `UPDATE users
       SET preferred_theme = $1,
           preferred_compact_mode = $2,
           preferred_currency = $3,
           preferred_date_format = $4,
           preferred_language = $5
       WHERE user_id = $6
       RETURNING preferred_theme, preferred_compact_mode, preferred_currency, preferred_date_format, preferred_language`,
      [
        nextTheme || current.preferred_theme || 'system',
        nextCompactMode === undefined ? Boolean(current.preferred_compact_mode) : nextCompactMode,
        nextCurrency || current.preferred_currency || 'USD',
        nextDateFormat || current.preferred_date_format || 'MM/DD/YYYY',
        nextLanguage || current.preferred_language || 'en',
        userId,
      ]
    );

    const row = result.rows[0];

    return res.status(200).json({
      message: 'Preferences updated',
      preferences: {
        theme: row.preferred_theme,
        compactMode: Boolean(row.preferred_compact_mode),
        currency: row.preferred_currency,
        dateFormat: row.preferred_date_format,
        language: row.preferred_language,
      },
    });
  } catch (err) {
    console.error('updatePreferenceSettings error:', err.message);
    return res.status(500).json({ error: 'Server error updating preferences' });
  }
};

const getSecuritySettings = async (req, res) => {
  const userId = req.userId;

  try {
    const result = await db.query(
      `SELECT two_factor_enabled, biometrics_enabled, session_timeout_enabled
       FROM user_security_settings
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      await db.query(
        `INSERT INTO user_security_settings (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );

      return res.status(200).json({
        settings: {
          twoFactorEnabled: false,
          biometricsEnabled: false,
          sessionTimeout: true,
        },
      });
    }

    const row = result.rows[0];

    return res.status(200).json({
      settings: {
        twoFactorEnabled: row.two_factor_enabled,
        biometricsEnabled: row.biometrics_enabled,
        sessionTimeout: row.session_timeout_enabled,
      },
    });
  } catch (err) {
    console.error('getSecuritySettings error:', err.message);
    return res.status(500).json({ error: 'Server error fetching security settings' });
  }
};

const updateSecuritySettings = async (req, res) => {
  const userId = req.userId;
  const settings = req.body?.settings;

  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'settings object is required' });
  }

  const asBool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

  try {
    const existing = await db.query(
      `SELECT two_factor_enabled, biometrics_enabled, session_timeout_enabled
       FROM user_security_settings
       WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows.length === 0) {
      await db.query(
        `INSERT INTO user_security_settings (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
    }

    const refreshed = await db.query(
      `SELECT two_factor_enabled, biometrics_enabled, session_timeout_enabled
       FROM user_security_settings
       WHERE user_id = $1`,
      [userId]
    );

    const current = refreshed.rows[0];

    const result = await db.query(
      `UPDATE user_security_settings
       SET
         two_factor_enabled = $1,
         biometrics_enabled = $2,
         session_timeout_enabled = $3,
         updated_at = NOW()
       WHERE user_id = $4
       RETURNING two_factor_enabled, biometrics_enabled, session_timeout_enabled`,
      [
        asBool(settings.twoFactorEnabled, current.two_factor_enabled),
        asBool(settings.biometricsEnabled, current.biometrics_enabled),
        asBool(settings.sessionTimeout, current.session_timeout_enabled),
        userId,
      ]
    );

    const row = result.rows[0];

    return res.status(200).json({
      message: 'Security settings updated',
      settings: {
        twoFactorEnabled: row.two_factor_enabled,
        biometricsEnabled: row.biometrics_enabled,
        sessionTimeout: row.session_timeout_enabled,
      },
    });
  } catch (err) {
    console.error('updateSecuritySettings error:', err.message);
    return res.status(500).json({ error: 'Server error updating security settings' });
  }
};

const getNotificationSettings = async (req, res) => {
  const userId = req.userId;

  try {
    const result = await db.query(
      `SELECT
         email_transactions,
         email_budget_alerts,
         email_goal_milestones,
         email_weekly_report,
         email_monthly_report,
         email_marketing,
         push_transactions,
         push_budget_alerts,
         push_goal_milestones,
         push_bill_reminders,
         in_app_transactions,
         in_app_budget_alerts,
         in_app_insights,
         in_app_tips
       FROM user_notification_settings
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification settings not found' });
    }

    const row = result.rows[0];

    return res.status(200).json({
      settings: {
        email: {
          transactions: row.email_transactions,
          budgetAlerts: row.email_budget_alerts,
          goalMilestones: row.email_goal_milestones,
          weeklyReport: row.email_weekly_report,
          monthlyReport: row.email_monthly_report,
          marketing: row.email_marketing,
        },
        push: {
          transactions: row.push_transactions,
          budgetAlerts: row.push_budget_alerts,
          goalMilestones: row.push_goal_milestones,
          billReminders: row.push_bill_reminders,
        },
        inApp: {
          transactions: row.in_app_transactions,
          budgetAlerts: row.in_app_budget_alerts,
          insights: row.in_app_insights,
          tips: row.in_app_tips,
        },
      },
    });
  } catch (err) {
    console.error('getNotificationSettings error:', err.message);
    return res.status(500).json({ error: 'Server error fetching notification settings' });
  }
};

const updateNotificationSettings = async (req, res) => {
  const userId = req.userId;
  const settings = req.body?.settings;

  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'settings object is required' });
  }

  const email = settings.email || {};
  const push = settings.push || {};
  const inApp = settings.inApp || {};

  const asBool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

  try {
    const existing = await db.query(
      `SELECT
         email_transactions,
         email_budget_alerts,
         email_goal_milestones,
         email_weekly_report,
         email_monthly_report,
         email_marketing,
         push_transactions,
         push_budget_alerts,
         push_goal_milestones,
         push_bill_reminders,
         in_app_transactions,
         in_app_budget_alerts,
         in_app_insights,
         in_app_tips
       FROM user_notification_settings
       WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows.length === 0) {
      await db.query(
        `INSERT INTO user_notification_settings (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
    }

    const refreshed = await db.query(
      `SELECT
         email_transactions,
         email_budget_alerts,
         email_goal_milestones,
         email_weekly_report,
         email_monthly_report,
         email_marketing,
         push_transactions,
         push_budget_alerts,
         push_goal_milestones,
         push_bill_reminders,
         in_app_transactions,
         in_app_budget_alerts,
         in_app_insights,
         in_app_tips
       FROM user_notification_settings
       WHERE user_id = $1`,
      [userId]
    );

    const current = refreshed.rows[0];

    const result = await db.query(
      `UPDATE user_notification_settings
       SET
         email_transactions = $1,
         email_budget_alerts = $2,
         email_goal_milestones = $3,
         email_weekly_report = $4,
         email_monthly_report = $5,
         email_marketing = $6,
         push_transactions = $7,
         push_budget_alerts = $8,
         push_goal_milestones = $9,
         push_bill_reminders = $10,
         in_app_transactions = $11,
         in_app_budget_alerts = $12,
         in_app_insights = $13,
         in_app_tips = $14,
         updated_at = NOW()
       WHERE user_id = $15
       RETURNING
         email_transactions,
         email_budget_alerts,
         email_goal_milestones,
         email_weekly_report,
         email_monthly_report,
         email_marketing,
         push_transactions,
         push_budget_alerts,
         push_goal_milestones,
         push_bill_reminders,
         in_app_transactions,
         in_app_budget_alerts,
         in_app_insights,
         in_app_tips`,
      [
        asBool(email.transactions, current.email_transactions),
        asBool(email.budgetAlerts, current.email_budget_alerts),
        asBool(email.goalMilestones, current.email_goal_milestones),
        asBool(email.weeklyReport, current.email_weekly_report),
        asBool(email.monthlyReport, current.email_monthly_report),
        asBool(email.marketing, current.email_marketing),
        asBool(push.transactions, current.push_transactions),
        asBool(push.budgetAlerts, current.push_budget_alerts),
        asBool(push.goalMilestones, current.push_goal_milestones),
        asBool(push.billReminders, current.push_bill_reminders),
        asBool(inApp.transactions, current.in_app_transactions),
        asBool(inApp.budgetAlerts, current.in_app_budget_alerts),
        asBool(inApp.insights, current.in_app_insights),
        asBool(inApp.tips, current.in_app_tips),
        userId,
      ]
    );

    const row = result.rows[0];

    return res.status(200).json({
      message: 'Notification settings updated',
      settings: {
        email: {
          transactions: row.email_transactions,
          budgetAlerts: row.email_budget_alerts,
          goalMilestones: row.email_goal_milestones,
          weeklyReport: row.email_weekly_report,
          monthlyReport: row.email_monthly_report,
          marketing: row.email_marketing,
        },
        push: {
          transactions: row.push_transactions,
          budgetAlerts: row.push_budget_alerts,
          goalMilestones: row.push_goal_milestones,
          billReminders: row.push_bill_reminders,
        },
        inApp: {
          transactions: row.in_app_transactions,
          budgetAlerts: row.in_app_budget_alerts,
          insights: row.in_app_insights,
          tips: row.in_app_tips,
        },
      },
    });
  } catch (err) {
    console.error('updateNotificationSettings error:', err.message);
    return res.status(500).json({ error: 'Server error updating notification settings' });
  }
};

const forgotPassword = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (email.length > 150) {
    return res.status(400).json({ error: 'Email must be 150 characters or less' });
  }

  try {
    await cleanupExpiredResetTokens();

    const result = await db.query(
      `SELECT user_id, name, email
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(200).json(createSessionSafeResponse());
    }

    const user = result.rows[0];
    const rawToken = createResetToken();
    const tokenHash = hashResetToken(rawToken);

    await db.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = $1
         AND used_at IS NULL`,
      [user.user_id]
    );

    await db.query(
      `INSERT INTO password_reset_tokens
        (user_id, token_hash, expires_at, requested_ip, requested_user_agent)
       VALUES ($1, $2, NOW() + ($3::text || ' minutes')::interval, $4, $5)`,
      [
        user.user_id,
        tokenHash,
        RESET_TOKEN_TTL_MINUTES,
        req.ip || null,
        req.get('user-agent') || null,
      ]
    );

    try {
      const delivery = await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        token: rawToken,
      });

      if (!delivery.delivered) {
        console.warn('Password reset email not delivered:', delivery.reason);
      }
    } catch (mailErr) {
      console.error('forgotPassword mail error:', mailErr.message);
    }

    return res.status(200).json(createSessionSafeResponse());
  } catch (err) {
    console.error('forgotPassword error:', err.message);
    return res.status(500).json({ error: 'Server error while processing password reset' });
  }
};

const resetPassword = async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token and newPassword are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  await cleanupExpiredResetTokens();

  const tokenHash = hashResetToken(token);

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const tokenResult = await client.query(
      `SELECT reset_token_id, user_id
       FROM password_reset_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Reset token is invalid or expired' });
    }

    const resetToken = tokenResult.rows[0];
    const userId = Number(resetToken.user_id);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const updatedUser = await client.query(
      `UPDATE users
       SET password = $1,
           token_version = token_version + 1
       WHERE user_id = $2
       RETURNING user_id, email, token_version`,
      [hashedPassword, userId]
    );

    if (updatedUser.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Reset token is invalid or expired' });
    }

    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = $1
         AND used_at IS NULL`,
      [userId]
    );

    await client.query('COMMIT');

    const user = updatedUser.rows[0];
    const nextToken = jwt.sign(
      { userId: user.user_id, email: user.email, tokenVersion: user.token_version || 0 },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'Password reset successful',
      token: nextToken,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('resetPassword rollback error:', rollbackErr.message);
    }

    console.error('resetPassword error:', err.message);
    return res.status(500).json({ error: 'Server error while resetting password' });
  } finally {
    client.release();
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  deleteMe,
  getPreferenceSettings,
  updatePreferenceSettings,
  getSecuritySettings,
  updateSecuritySettings,
  getNotificationSettings,
  updateNotificationSettings,
  forgotPassword,
  resetPassword,
};