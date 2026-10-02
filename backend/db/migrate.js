const db = require('./db');

const CANONICAL_CATEGORIES = [
  { name: 'Income', type: 'income', icon: '💼', color: '#1D9E75' },
  { name: 'Transfers', type: 'expense', icon: '↔️', color: '#0C447C' },
  { name: 'Bills', type: 'expense', icon: '📄', color: '#5F5E5A' },
  { name: 'Groceries', type: 'expense', icon: '🛒', color: '#1D9E75' },
  { name: 'Food & Dining', type: 'expense', icon: '🍽️', color: '#E85D24' },
  { name: 'Transport', type: 'expense', icon: '🚗', color: '#378ADD' },
  { name: 'Shopping', type: 'expense', icon: '🛍️', color: '#D4537E' },
  { name: 'Subscriptions', type: 'expense', icon: '📺', color: '#534AB7' },
  { name: 'Entertainment', type: 'expense', icon: '🎮', color: '#7F77DD' },
  { name: 'Healthcare', type: 'expense', icon: '🏥', color: '#E24B4A' },
  { name: 'Education', type: 'expense', icon: '📚', color: '#378ADD' },
  { name: 'Charity', type: 'expense', icon: '❤️', color: '#D4537E' },
  { name: 'Debt Repayment', type: 'expense', icon: '💸', color: '#B85C38' },
  { name: 'Fees & Charges', type: 'expense', icon: '💳', color: '#888780' },
  { name: 'Cash Withdrawal', type: 'expense', icon: '💵', color: '#888780' },
  { name: 'Government/Legal', type: 'expense', icon: '🏛️', color: '#5F5E5A' },
  { name: 'Other', type: 'expense', icon: '📦', color: '#B4B2A9' },
];

const seedCanonicalCategories = async () => {
  for (const category of CANONICAL_CATEGORIES) {
    await db.query(
      `INSERT INTO categories (name, type, icon, color)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name)
       DO UPDATE SET
         type = EXCLUDED.type,
         icon = EXCLUDED.icon,
         color = EXCLUDED.color`,
      [category.name, category.type, category.icon, category.color]
    );
  }
};

const runMigrations = async ({ exitOnFinish = false } = {}) => {
  try {

    // 1. USERS
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id     SERIAL PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        email       VARCHAR(150) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        token_version INT NOT NULL DEFAULT 0,
        monthly_income DECIMAL(12,2) DEFAULT 0,
        city        VARCHAR(100),
        occupation  VARCHAR(100),
        phone       VARCHAR(30),
        bio         TEXT,
        avatar_url  TEXT,
        preferred_theme VARCHAR(20) DEFAULT 'system',
        preferred_compact_mode BOOLEAN DEFAULT FALSE,
        preferred_currency VARCHAR(10) DEFAULT 'USD',
        preferred_date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
        preferred_language VARCHAR(10) DEFAULT 'en',
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ users table');

    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS monthly_income DECIMAL(12,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS city VARCHAR(100),
      ADD COLUMN IF NOT EXISTS occupation VARCHAR(100),
      ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
      ADD COLUMN IF NOT EXISTS bio TEXT,
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS preferred_theme VARCHAR(20) DEFAULT 'system',
      ADD COLUMN IF NOT EXISTS preferred_compact_mode BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) DEFAULT 'USD',
      ADD COLUMN IF NOT EXISTS preferred_date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
      ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
    `);
    console.log('✓ users compatibility fields');

    // 2. CATEGORIES
    await db.query(`
      CREATE TABLE IF NOT EXISTS categories (
        category_id  SERIAL PRIMARY KEY,
        name         VARCHAR(100) UNIQUE NOT NULL,
        type         VARCHAR(20) DEFAULT 'expense',
        icon         VARCHAR(50),
        color        VARCHAR(20)
      );
    `);
    console.log('✓ categories table');

    // 3. TRANSACTIONS
    await db.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        transaction_id  SERIAL PRIMARY KEY,
        user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        category_id     INT REFERENCES categories(category_id),
        description     VARCHAR(255) NOT NULL,
        merchant        VARCHAR(150),
        amount          DECIMAL(12,2) NOT NULL,
        type            VARCHAR(10) DEFAULT 'expense',
        date            DATE DEFAULT CURRENT_DATE,
        notes           TEXT,
        status          VARCHAR(30) DEFAULT 'completed',
        source          VARCHAR(30) DEFAULT 'Bank',
        ml_confidence   DECIMAL(5,4),
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ transactions table');

    await db.query(`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'completed',
      ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'Bank',
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    `);

    await db.query(`
      UPDATE transactions
      SET status = COALESCE(NULLIF(TRIM(status), ''), 'completed'),
          source = COALESCE(NULLIF(TRIM(source), ''), 'Bank'),
          updated_at = COALESCE(updated_at, created_at, NOW())
      WHERE status IS NULL
         OR TRIM(status) = ''
         OR source IS NULL
         OR TRIM(source) = ''
         OR updated_at IS NULL;
    `);

    console.log('✓ transactions compatibility fields');

    // 3b. IMPORT SESSIONS
    await db.query(`
      CREATE TABLE IF NOT EXISTS import_sessions (
        import_session_id    VARCHAR(64) PRIMARY KEY,
        user_id              INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        file_name            TEXT NOT NULL,
        mime_type            VARCHAR(150) NOT NULL,
        source_type          VARCHAR(20) NOT NULL,
        source_bank          VARCHAR(50) DEFAULT 'unknown',
        parser_name          VARCHAR(100),
        detection_confidence DECIMAL(5,4),
        state                VARCHAR(30) NOT NULL DEFAULT 'uploaded',
        warnings             JSONB DEFAULT '[]'::jsonb,
        summary              JSONB DEFAULT '{}'::jsonb,
        created_at           TIMESTAMP DEFAULT NOW(),
        updated_at           TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS import_session_rows (
        import_row_id          SERIAL PRIMARY KEY,
        import_session_id      VARCHAR(64) NOT NULL REFERENCES import_sessions(import_session_id) ON DELETE CASCADE,
        row_index              INT NOT NULL,
        raw_payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
        normalized_payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
        review_payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
        extraction_confidence  DECIMAL(5,4),
        needs_review           BOOLEAN DEFAULT FALSE,
        dedupe_fingerprint     VARCHAR(128),
        dedupe_status          VARCHAR(30) DEFAULT 'clear',
        duplicate_reason       TEXT,
        top_predictions        JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_excluded            BOOLEAN DEFAULT FALSE,
        created_at             TIMESTAMP DEFAULT NOW(),
        updated_at             TIMESTAMP DEFAULT NOW(),
        UNIQUE(import_session_id, row_index)
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_import_sessions_user_created
      ON import_sessions(user_id, created_at DESC);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_import_rows_session
      ON import_session_rows(import_session_id, row_index ASC);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_import_rows_fingerprint
      ON import_session_rows(dedupe_fingerprint);
    `);

    await db.query(`
      ALTER TABLE import_session_rows
      ADD COLUMN IF NOT EXISTS top_predictions JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);

    console.log('✓ import session tables');

    // 4. BUDGETS
    await db.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        budget_id     SERIAL PRIMARY KEY,
        user_id       INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        category_id   INT NOT NULL REFERENCES categories(category_id),
        monthly_limit DECIMAL(12,2) NOT NULL,
        month         INT NOT NULL,
        year          INT NOT NULL,
        created_at    TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, category_id, month, year)
      );
    `);
    console.log('✓ budgets table');

    // 4b. BUDGET PLANS
    await db.query(`
      CREATE TABLE IF NOT EXISTS budget_plans (
        plan_id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        source VARCHAR(50) NOT NULL DEFAULT 'system',
        monthly_income_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0,
        occupation_snapshot VARCHAR(100),
        city_snapshot VARCHAR(100),
        has_debt BOOLEAN NOT NULL DEFAULT FALSE,
        debt_amount DECIMAL(12,2),
        minimum_monthly_debt_payment DECIMAL(12,2),
        debt_priority VARCHAR(20),
        debt_type VARCHAR(80),
        debt_notes TEXT,
        recommended_monthly_debt_payment DECIMAL(12,2) NOT NULL DEFAULT 0,
        recommended_savings_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        recommended_savings_percent DECIMAL(6,3) NOT NULL DEFAULT 0,
        rationale_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        accepted_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT budget_plans_status_check CHECK (status IN ('draft', 'active', 'archived')),
        CONSTRAINT budget_plans_debt_priority_check CHECK (debt_priority IS NULL OR debt_priority IN ('low', 'medium', 'high')),
        CONSTRAINT budget_plans_monthly_income_non_negative CHECK (monthly_income_snapshot >= 0),
        CONSTRAINT budget_plans_recommended_debt_non_negative CHECK (recommended_monthly_debt_payment >= 0),
        CONSTRAINT budget_plans_recommended_savings_non_negative CHECK (recommended_savings_amount >= 0),
        CONSTRAINT budget_plans_recommended_savings_percent_non_negative CHECK (recommended_savings_percent >= 0)
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS budget_plan_allocations (
        allocation_id SERIAL PRIMARY KEY,
        plan_id INT NOT NULL REFERENCES budget_plans(plan_id) ON DELETE CASCADE,
        category_id INT NOT NULL REFERENCES categories(category_id),
        allocation_amount DECIMAL(12,2) NOT NULL,
        allocation_percent DECIMAL(6,3) NOT NULL DEFAULT 0,
        is_debt_allocation BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT budget_plan_allocations_amount_non_negative CHECK (allocation_amount >= 0),
        CONSTRAINT budget_plan_allocations_percent_non_negative CHECK (allocation_percent >= 0),
        CONSTRAINT budget_plan_allocations_plan_category_unique UNIQUE (plan_id, category_id)
      );
    `);

    await db.query(`
      ALTER TABLE budget_plans
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'system',
      ADD COLUMN IF NOT EXISTS monthly_income_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS occupation_snapshot VARCHAR(100),
      ADD COLUMN IF NOT EXISTS city_snapshot VARCHAR(100),
      ADD COLUMN IF NOT EXISTS has_debt BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS debt_amount DECIMAL(12,2),
      ADD COLUMN IF NOT EXISTS minimum_monthly_debt_payment DECIMAL(12,2),
      ADD COLUMN IF NOT EXISTS debt_priority VARCHAR(20),
      ADD COLUMN IF NOT EXISTS debt_type VARCHAR(80),
      ADD COLUMN IF NOT EXISTS debt_notes TEXT,
      ADD COLUMN IF NOT EXISTS recommended_monthly_debt_payment DECIMAL(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS recommended_savings_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS recommended_savings_percent DECIMAL(6,3) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rationale_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
    `);

    await db.query(`
      ALTER TABLE budget_plan_allocations
      ADD COLUMN IF NOT EXISTS allocation_percent DECIMAL(6,3) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_debt_allocation BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_budget_plans_user_status_updated
      ON budget_plans(user_id, status, updated_at DESC);
    `);

    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_plans_single_active_per_user
      ON budget_plans(user_id)
      WHERE status = 'active';
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_budget_plan_allocations_plan
      ON budget_plan_allocations(plan_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_budget_plan_allocations_category
      ON budget_plan_allocations(category_id);
    `);

    console.log('✓ budget plan tables');

    // 5. GOALS
    await db.query(`
      CREATE TABLE IF NOT EXISTS goals (
        goal_id          SERIAL PRIMARY KEY,
        user_id          INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        title            VARCHAR(150) NOT NULL,
        target_amount    DECIMAL(12,2) NOT NULL,
        current_savings  DECIMAL(12,2) DEFAULT 0,
        deadline         DATE,
        status           VARCHAR(20) DEFAULT 'active',
        created_at       TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ goals table');

    // 6. SUGGESTIONS
    await db.query(`
      CREATE TABLE IF NOT EXISTS suggestions (
        suggestion_id  SERIAL PRIMARY KEY,
        user_id        INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        title          VARCHAR(200) NOT NULL,
        description    TEXT NOT NULL,
        severity       VARCHAR(20) DEFAULT 'info',
        is_read        BOOLEAN DEFAULT FALSE,
        created_at     TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ suggestions table');

    // 7. AI LOGS
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_logs (
        log_id         SERIAL PRIMARY KEY,
        user_id        INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        input_text     TEXT NOT NULL,
        response_text  TEXT NOT NULL,
        channel        VARCHAR(20) DEFAULT 'text',
        created_at     TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ ai_logs table');

    // 8. SUPPORT REQUESTS
    await db.query(`
      CREATE TABLE IF NOT EXISTS support_requests (
        support_request_id SERIAL PRIMARY KEY,
        user_id            INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        subject            VARCHAR(200) NOT NULL,
        message            TEXT NOT NULL,
        status             VARCHAR(30) DEFAULT 'open',
        created_at         TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ support_requests table');

    // 9. AI ACTION REQUESTS
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_action_requests (
        action_request_id   UUID PRIMARY KEY,
        user_id             INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        ai_log_id           INT REFERENCES ai_logs(log_id) ON DELETE SET NULL,
        action_type         VARCHAR(50) NOT NULL,
        action_payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
        confirmation_summary TEXT NOT NULL,
        status              VARCHAR(20) NOT NULL DEFAULT 'pending',
        correlation_id      VARCHAR(120),
        error_message       TEXT,
        expires_at          TIMESTAMPTZ NOT NULL,
        executed_at         TIMESTAMPTZ,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT ai_action_requests_status_check
          CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired', 'executed', 'failed')),
        CONSTRAINT ai_action_requests_type_check
          CHECK (action_type IN ('create_budget', 'update_budget', 'create_goal', 'update_goal'))
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_action_requests_user_status_created
      ON ai_action_requests(user_id, status, created_at DESC);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_action_requests_expires_at
      ON ai_action_requests(expires_at);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_action_requests_correlation
      ON ai_action_requests(correlation_id)
      WHERE correlation_id IS NOT NULL;
    `);

    await db.query(`
      ALTER TABLE ai_action_requests
      ADD COLUMN IF NOT EXISTS ai_log_id INT REFERENCES ai_logs(log_id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(120),
      ADD COLUMN IF NOT EXISTS error_message TEXT,
      ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await db.query(`
      UPDATE ai_action_requests
      SET updated_at = COALESCE(updated_at, created_at, NOW())
      WHERE updated_at IS NULL;
    `);

    await db.query(`
      UPDATE ai_action_requests
      SET status = 'expired',
          updated_at = NOW(),
          error_message = COALESCE(error_message, 'Expired during migration backfill')
      WHERE status = 'pending'
        AND expires_at < NOW();
    `);

    console.log('✓ ai_action_requests table');

    // 10. USER NOTIFICATION SETTINGS
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_notification_settings (
        user_id                 INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
        email_transactions      BOOLEAN DEFAULT TRUE,
        email_budget_alerts     BOOLEAN DEFAULT TRUE,
        email_goal_milestones   BOOLEAN DEFAULT TRUE,
        email_weekly_report     BOOLEAN DEFAULT TRUE,
        email_monthly_report    BOOLEAN DEFAULT FALSE,
        email_marketing         BOOLEAN DEFAULT FALSE,
        push_transactions       BOOLEAN DEFAULT TRUE,
        push_budget_alerts      BOOLEAN DEFAULT TRUE,
        push_goal_milestones    BOOLEAN DEFAULT TRUE,
        push_bill_reminders     BOOLEAN DEFAULT TRUE,
        in_app_transactions     BOOLEAN DEFAULT TRUE,
        in_app_budget_alerts    BOOLEAN DEFAULT TRUE,
        in_app_insights         BOOLEAN DEFAULT TRUE,
        in_app_tips             BOOLEAN DEFAULT TRUE,
        created_at              TIMESTAMP DEFAULT NOW(),
        updated_at              TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.query(`
      INSERT INTO user_notification_settings (user_id)
      SELECT user_id FROM users
      ON CONFLICT (user_id) DO NOTHING;
    `);
    console.log('✓ user_notification_settings table');

    // 10. USER SECURITY SETTINGS
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_security_settings (
        user_id                 INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
        two_factor_enabled      BOOLEAN DEFAULT FALSE,
        biometrics_enabled      BOOLEAN DEFAULT FALSE,
        session_timeout_enabled BOOLEAN DEFAULT TRUE,
        created_at              TIMESTAMP DEFAULT NOW(),
        updated_at              TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.query(`
      INSERT INTO user_security_settings (user_id)
      SELECT user_id FROM users
      ON CONFLICT (user_id) DO NOTHING;
    `);
    console.log('✓ user_security_settings table');

    await db.query(`
      ALTER TABLE transactions
      ADD COLUMN IF NOT EXISTS source_import_session_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS source_reference_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS dedupe_fingerprint VARCHAR(128);
    `);

    await db.query(`
      ALTER TABLE transactions
      DROP COLUMN IF EXISTS top_predictions;
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_dedupe_fingerprint
      ON transactions(user_id, dedupe_fingerprint);
    `);

    console.log('✓ transactions import reference fields');

    await db.query(`
      CREATE TABLE IF NOT EXISTS merchant_category_rules (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        pattern TEXT NOT NULL,
        category_id INT NOT NULL REFERENCES categories(category_id),
        match_type TEXT NOT NULL DEFAULT 'exact',
        source TEXT NOT NULL DEFAULT 'user_correction',
        use_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, pattern, match_type)
      );
    `);

    await db.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'merchant_category_rules' AND column_name = 'rule_id'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'merchant_category_rules' AND column_name = 'id'
        ) THEN
          ALTER TABLE merchant_category_rules RENAME COLUMN rule_id TO id;
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'merchant_category_rules' AND column_name = 'merchant_pattern'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'merchant_category_rules' AND column_name = 'pattern'
        ) THEN
          ALTER TABLE merchant_category_rules RENAME COLUMN merchant_pattern TO pattern;
        END IF;
      END $$;
    `);

    await db.query(`
      ALTER TABLE merchant_category_rules
      ADD COLUMN IF NOT EXISTS id SERIAL,
      ADD COLUMN IF NOT EXISTS pattern TEXT,
      ADD COLUMN IF NOT EXISTS match_type TEXT NOT NULL DEFAULT 'exact',
      ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user_correction',
      ADD COLUMN IF NOT EXISTS use_count INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await db.query(`
      ALTER TABLE merchant_category_rules
      DROP COLUMN IF EXISTS confidence;
    `);

    await db.query(`
      UPDATE merchant_category_rules
      SET pattern = UPPER(TRIM(pattern)),
          match_type = COALESCE(NULLIF(TRIM(match_type), ''), 'exact'),
          source = COALESCE(NULLIF(TRIM(source), ''), 'user_correction'),
          use_count = COALESCE(use_count, 0),
          created_at = COALESCE(created_at, NOW()),
          updated_at = COALESCE(updated_at, NOW());
    `);

    await db.query(`
      DELETE FROM merchant_category_rules
      WHERE pattern IS NULL OR TRIM(pattern) = '';
    `);

    await db.query(`
      ALTER TABLE merchant_category_rules
      ALTER COLUMN pattern SET NOT NULL,
      ALTER COLUMN pattern TYPE TEXT,
      ALTER COLUMN match_type SET NOT NULL,
      ALTER COLUMN source SET NOT NULL,
      ALTER COLUMN use_count SET NOT NULL;
    `);

    await db.query(`
      DO $$
      DECLARE
        existing_constraint TEXT;
      BEGIN
        FOR existing_constraint IN
          SELECT c.conname
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = 'merchant_category_rules'
            AND c.contype = 'u'
            AND c.conname <> 'merchant_category_rules_user_pattern_match_type_key'
        LOOP
          EXECUTE format('ALTER TABLE merchant_category_rules DROP CONSTRAINT IF EXISTS %I', existing_constraint);
        END LOOP;
      END $$;
    `);

    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = 'merchant_category_rules'
            AND c.conname = 'merchant_category_rules_user_pattern_match_type_key'
        ) THEN
          ALTER TABLE merchant_category_rules
          ADD CONSTRAINT merchant_category_rules_user_pattern_match_type_key
          UNIQUE(user_id, pattern, match_type);
        END IF;
      END $$;
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_merchant_category_rules_user_pattern
      ON merchant_category_rules(user_id, pattern);
    `);

    console.log('✓ merchant category rules table');

    await db.query(`
      CREATE TABLE IF NOT EXISTS category_feedback_events (
        feedback_event_id BIGSERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        transaction_id INT REFERENCES transactions(transaction_id) ON DELETE SET NULL,
        import_session_id VARCHAR(64) REFERENCES import_sessions(import_session_id) ON DELETE SET NULL,
        row_index INT,
        feedback_kind VARCHAR(40) NOT NULL,
        signal_type VARCHAR(20) NOT NULL,
        predicted_category_id INT REFERENCES categories(category_id),
        predicted_category_name VARCHAR(100),
        predicted_confidence DECIMAL(5,4),
        predicted_source VARCHAR(40),
        predicted_margin DECIMAL(5,4),
        predicted_ambiguous BOOLEAN,
        final_category_id INT REFERENCES categories(category_id),
        final_category_name VARCHAR(100),
        merchant TEXT,
        normalized_merchant TEXT,
        description TEXT,
        normalized_description TEXT,
        amount DECIMAL(12,2),
        direction VARCHAR(20),
        source_bank VARCHAR(50),
        channel VARCHAR(50),
        model_version VARCHAR(80),
        override_source VARCHAR(40),
        override_rule_id INT,
        override_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        used_for_training BOOLEAN NOT NULL DEFAULT FALSE,
        export_batch_id VARCHAR(80),
        exported_at TIMESTAMPTZ,
        event_hash VARCHAR(128),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT category_feedback_events_feedback_kind_check
          CHECK (feedback_kind IN ('explicit_correction', 'explicit_confirmation', 'manual_labeling', 'post_save_edit')),
        CONSTRAINT category_feedback_events_signal_type_check
          CHECK (signal_type IN ('correction', 'confirmation', 'label'))
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_category_feedback_events_user_created
      ON category_feedback_events(user_id, created_at DESC);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_category_feedback_events_transaction
      ON category_feedback_events(transaction_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_category_feedback_events_import_row
      ON category_feedback_events(import_session_id, row_index);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_category_feedback_events_training
      ON category_feedback_events(used_for_training, created_at DESC);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_category_feedback_events_merchant
      ON category_feedback_events(user_id, normalized_merchant);
    `);

    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_category_feedback_events_event_hash
      ON category_feedback_events(event_hash)
      WHERE event_hash IS NOT NULL;
    `);

    console.log('✓ category feedback events table');

    await db.query(`
      CREATE TABLE IF NOT EXISTS merchant_pattern_memory (
        memory_id BIGSERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        normalized_merchant TEXT NOT NULL,
        pattern TEXT NOT NULL,
        category_id INT NOT NULL REFERENCES categories(category_id),
        source_bank VARCHAR(50),
        channel VARCHAR(50),
        direction VARCHAR(20),
        correction_count INTEGER NOT NULL DEFAULT 0,
        confirmation_count INTEGER NOT NULL DEFAULT 0,
        total_evidence_count INTEGER NOT NULL DEFAULT 0,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_corrected_at TIMESTAMPTZ,
        last_confirmed_at TIMESTAMPTZ,
        last_feedback_event_id BIGINT REFERENCES category_feedback_events(feedback_event_id) ON DELETE SET NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_merchant_pattern_memory_user_merchant
      ON merchant_pattern_memory(user_id, normalized_merchant);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_merchant_pattern_memory_user_active_updated
      ON merchant_pattern_memory(user_id, is_active, updated_at DESC);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_merchant_pattern_memory_feedback_event
      ON merchant_pattern_memory(last_feedback_event_id);
    `);

    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_pattern_memory_scope_unique
      ON merchant_pattern_memory(
        user_id,
        normalized_merchant,
        COALESCE(source_bank, ''),
        COALESCE(channel, ''),
        COALESCE(direction, '')
      );
    `);

    console.log('✓ merchant pattern memory table');

    await db.query(`
      CREATE TABLE IF NOT EXISTS anomalies (
        anomaly_id BIGSERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        transaction_id INT REFERENCES transactions(transaction_id) ON DELETE SET NULL,
        anomaly_type VARCHAR(80) NOT NULL,
        scope VARCHAR(20) NOT NULL DEFAULT 'transaction',
        severity VARCHAR(10) NOT NULL DEFAULT 'low',
        title VARCHAR(200) NOT NULL,
        explanation TEXT NOT NULL,
        evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        dedupe_key VARCHAR(255) NOT NULL,
        year INT,
        month INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT anomalies_scope_check CHECK (scope IN ('transaction', 'month')),
        CONSTRAINT anomalies_severity_check CHECK (severity IN ('low', 'medium', 'high')),
        CONSTRAINT anomalies_status_check CHECK (status IN ('active', 'read', 'dismissed', 'resolved')),
        CONSTRAINT anomalies_month_check CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
        CONSTRAINT anomalies_dedupe_unique UNIQUE (user_id, dedupe_key)
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_anomalies_user_status_created
      ON anomalies(user_id, status, created_at DESC);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_anomalies_user_transaction
      ON anomalies(user_id, transaction_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_anomalies_user_month
      ON anomalies(user_id, year, month);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_anomalies_user_severity_active
      ON anomalies(user_id, severity, created_at DESC)
      WHERE status = 'active';
    `);

    console.log('✓ anomalies table');

    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        reset_token_id BIGSERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        token_hash VARCHAR(128) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        requested_ip VARCHAR(64),
        requested_user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT password_reset_tokens_token_hash_unique UNIQUE (token_hash)
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_created
      ON password_reset_tokens(user_id, created_at DESC);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
      ON password_reset_tokens(expires_at);
    `);

    console.log('✓ password reset tokens table');

    // 11. ADMIN ROLE + STATUS on users
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
    `);

    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT users_role_check
            CHECK (role IN ('admin', 'user'));
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT users_status_check
            CHECK (status IN ('active', 'suspended'));
        END IF;
      END $$;
    `);

    console.log('✓ users role/status columns');

    // 12. ADMIN AUDIT LOGS
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        audit_log_id     BIGSERIAL PRIMARY KEY,
        actor_user_id    INT REFERENCES users(user_id) ON DELETE SET NULL,
        actor_email      VARCHAR(150),
        action           VARCHAR(60) NOT NULL,
        resource_type    VARCHAR(60) NOT NULL,
        resource_id      VARCHAR(60),
        ip_address       VARCHAR(64),
        user_agent       TEXT,
        request_payload  JSONB,
        response_status  INT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_audit_actor
      ON admin_audit_logs(actor_user_id, created_at DESC);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_audit_resource
      ON admin_audit_logs(resource_type, resource_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_audit_action
      ON admin_audit_logs(action, created_at DESC);
    `);

    console.log('✓ admin_audit_logs table');

    await seedCanonicalCategories();
    console.log('✓ canonical categories seeded');

    console.log('\n✅ All tables created successfully!');
    if (exitOnFinish) process.exit(0);

  } catch (err) {
    console.error('Migration error:', err.message);
    if (exitOnFinish) process.exit(1);
    throw err;
  }
};

if (require.main === module) {
  runMigrations({ exitOnFinish: true });
}

module.exports = runMigrations;