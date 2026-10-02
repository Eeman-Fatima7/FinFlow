/**
 * Creates the first admin user for FinFlow.
 * Usage:
 *   node scripts/create-first-admin.js --email admin@finflow.com --password Admin@123456
 *   node scripts/create-first-admin.js --email admin@finflow.com --password Admin@123456 --name "Admin"
 *
 * This is for DEVELOPMENT / DEMO only. Do not use in production without review.
 */

const bcrypt = require('bcryptjs');
const db = require('../db/db');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email') parsed.email = args[++i];
    else if (args[i] === '--password') parsed.password = args[++i];
    else if (args[i] === '--name') parsed.name = args[++i];
  }
  return parsed;
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (pw) => pw && pw.length >= 8;

const main = async () => {
  const { email, password, name = 'Admin' } = parseArgs();

  if (!email || !password) {
    console.error('Usage: node scripts/create-first-admin.js --email <email> --password <password> [--name "Admin"]');
    console.error('Example: node scripts/create-first-admin.js --email admin@finflow.com --password Admin@123456');
    process.exit(1);
  }

  if (!validateEmail(email)) {
    console.error('Error: Invalid email address');
    process.exit(1);
  }

  if (!validatePassword(password)) {
    console.error('Error: Password must be at least 8 characters');
    process.exit(1);
  }

  try {
    // Check if user already exists
    const existing = await db.query(`SELECT user_id, role FROM users WHERE email = $1`, [email]);
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      if (user.role === 'admin') {
        console.log(`✓ User ${email} is already an admin (user_id: ${user.user_id})`);
      } else {
        // Upgrade existing user to admin
        await db.query(`UPDATE users SET role = 'admin', token_version = token_version + 1 WHERE user_id = $1`, [user.user_id]);
        console.log(`✓ Upgraded ${email} to admin (user_id: ${user.user_id})`);
      }
      process.exit(0);
    }

    // Create new admin user
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (name, email, password, role, status, monthly_income)
       VALUES ($1, $2, $3, 'admin', 'active', 0)
       RETURNING user_id`,
      [name, email, hashedPassword]
    );

    console.log(`✓ Created admin user: ${email} (user_id: ${result.rows[0].user_id})`);
    console.log(`  Password set. You can now log in as this admin.`);
    process.exit(0);
  } catch (err) {
    if (err.code === '23505') {
      console.error('Error: A user with this email already exists');
    } else {
      console.error('Error:', err.message);
    }
    process.exit(1);
  }
};

main();