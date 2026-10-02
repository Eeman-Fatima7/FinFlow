-- FinFlow — Create First Admin (SQL-only alternative)
-- Run with: psql -d $DB_NAME -U $DB_USER -f create-first-admin.sql
-- Or paste into pgAdmin/DBeaver.
--
-- This script creates or upgrades a user to admin role.
-- Does NOT create a new user — the user must already exist in the users table.
-- Adjust the WHERE email clause to match your target user.

-- 1. Set the target user's role to admin
UPDATE users
SET role = 'admin'
WHERE email = 'admin@finflow.com';

-- 2. Verify
-- SELECT user_id, name, email, role, status FROM users WHERE email = 'admin@finflow.com';

-- 3. If the user does not exist yet, insert them (uncomment and fill in):
-- INSERT INTO users (name, email, password_hash, role, status, created_at)
-- VALUES (
--   'Admin',
--   'admin@finflow.com',
--   -- Hash 'Admin@123456' with bcrypt cost 12:
--   -- $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.TZfyYqU8kIq3Hy
--   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.TZfyYqU8kIq3Hy',
--   'admin',
--   'active',
--   NOW()
-- );

-- 4. Default any users without a role to 'user'
-- UPDATE users SET role = 'user' WHERE role IS NULL;

-- 5. Default any users without a status to 'active'
-- UPDATE users SET status = 'active' WHERE status IS NULL;
