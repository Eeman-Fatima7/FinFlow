# CLAUDE.md — AI Personal Finance Advisor (FYP) Master Context

**Last updated:** 2026-04-26  
**Purpose:** End-to-end, code-verified project handoff for Claude sessions (implementation, review, and thesis/report generation).

---

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. Prefer code-review-graph MCP tools before broad file scanning for exploration/review work.**

Preferred workflow:
1. `detect_changes` for review context.
2. `get_affected_flows` / `get_impact_radius` for blast radius.
3. `query_graph` for callers/callees/tests/import relationships.
4. Fall back to Grep/Glob/Read when graph coverage is insufficient.

---

## 1) Source-of-Truth Rules

When information conflicts:
1. Treat current code in `backend/`, `frontend/`, and `ml/` as authoritative.
2. Use `docs/progress.md` as phase ledger and change tracker.
3. Use `docs/PROJECT_MASTER_SUMMARY.md` as consolidated audit narrative.
4. Treat historical docs as non-authoritative unless code-verified.

For thesis/report writing:
- Do not fabricate features, tests, metrics, or deployment outcomes.
- Only claim behavior that is implemented and wired in code.
- Mark remaining work explicitly as future work.

---

## 2) Project Overview

AI-powered personal finance advisor web app with budgeting, transaction intelligence, forecasting, anomaly detection, onboarding planning, and conversational guidance.

Integrated domains:
- Auth/session security hardening
- Transaction CRUD + staged statement import
- Hybrid categorization + merchant correction loop
- Budgets/goals/suggestions/dashboard analytics
- Onboarding budget-plan lifecycle (draft → preview/edit → accept → active)
- AI advisor (chat + voice + action confirmation)
- Forecasting with reliability metadata and sparse-history fallbacks
- Anomaly detection lifecycle
- Stocks fundamentals/indicators + AI insight summaries

---

## 3) Architecture

### Frontend
- Next.js 16 (App Router), TypeScript, Tailwind CSS
- Auth provider + onboarding-aware auth guard
- Routes: summary, transactions/import, goals, chat, voice, stocks

### Backend
- Node.js + Express + PostgreSQL
- Controller/service layering
- JWT middleware + DB token-version enforcement
- Orchestration for import, categorization, advisor, anomalies, onboarding plans, and stocks

### ML Service
- Python FastAPI
- Rule-first + model fallback categorization
- Statement extraction pipeline
- Personalized forecasting pipeline

### External Integrations
- Advisor provider: EcomAgent-compatible chat completions
- Runtime LLM default: `claude-opus-4.6`
- Stocks providers: Finnhub + Twelve Data + yfinance fallback endpoints in ML
- Document extraction: AWS Textract adapter flow for PDF/image statements

---

## 4) Delivery Phases (Completed)

| Phase | Scope | Status |
|---|---|---|
| 1 | Project setup & structure | ✅ Complete |
| 2 | DB schema & migrations | ✅ Complete |
| 3 | Auth API | ✅ Complete |
| 4 | Core finance APIs | ✅ Complete |
| 5 | ML categorization + forecast | ✅ Complete |
| 6 | Budget engine + AI advisor | ✅ Complete |
| 7 | Frontend dashboard MVP | ✅ Complete |
| 8 | Statement import engine | ✅ Complete |
| 9 | Hybrid categorization | ✅ Complete |
| 10 | Learning loop | ✅ Complete |
| 11 | Personalized forecast | ✅ Complete |
| 12 | Anomaly lifecycle | ✅ Complete |
| 13 | Structured AI context | ✅ Complete |
| 14 | Hardening + observability | ✅ Complete |
| 15 | Textract migration | ✅ Complete |
| 16 | Stocks module | ✅ Complete |
| 17 | AI action confirmations | ✅ Complete |
| 18 | Onboarding budget-plan lifecycle | ✅ Complete |

---

## 5) End-to-End Capability Map

### 5.1 Authentication & Security
- Register/login/me + JWT-protected routes
- DB-backed `token_version` stale-session invalidation
- Forgot/reset password lifecycle with hashed one-time tokens
- Rate limits on auth-sensitive endpoints
- CORS allowlisting with safe localhost defaults

### 5.2 Transactions + Import Pipeline
- Transaction CRUD + batch paths
- Import preview/review/confirm session architecture
- CSV native extraction + PDF/image Textract extraction split
- Normalization + dedupe annotation + confirm-time dedupe recheck
- Partial confirm semantics with row-indexed errors
- Date-integrity hardening: invalid dates blocked and surfaced in `validation_blocks[]`

### 5.3 Hybrid Categorization Runtime (Actual Priority)
1. Manual category from user payload
2. Merchant pattern memory override (`merchant_pattern_memory`, source `override`)
3. User merchant rule (`merchant_category_rules`, source `user_rule`)
4. ML deterministic rule layer (`source = rule`)
5. ML model prediction fallback (`source = model`)

Shared confidence thresholds (backend + ML):
- `CONFIDENCE_HIGH = 0.85`
- `CONFIDENCE_MEDIUM = 0.60`
- `AMBIGUITY_MARGIN = 0.08`

### 5.4 Merchant Correction Loop + Model Improvement
- Feedback events saved in `category_feedback_events`
- Immediate memory updates via `upsertMemoryFromFeedback(...)`
- Optional rule upserts in `merchant_category_rules`
- Export script: `npm run export:feedback` → `ml/data/corrections_feedback.csv`
- Retrain script: `npm run retrain:feedback` → `python ml/train.py --feedback-file ... --model-version ...`
- Safe artifact promotion from candidate files after successful write

### 5.5 Budgeting, Goals, Dashboard
- Budget CRUD + runtime progress views
- Goal CRUD
- Suggestion generation/persistence/read-state
- Dashboard summary with category breakdown, overspending flags, forecast, anomaly summary
- Active onboarding plan compatibility through budget runtime metrics

### 5.6 Onboarding Budget-Plan Lifecycle
- Signup creates draft onboarding plan (`budget_plans` + allocations)
- `/onboarding/*` APIs for status/get/preview/update/accept
- Debt-aware suggestions with `debt_priority_mode` (`avalanche|snowball`)
- Questionnaire includes income stability, household/dependents, essentials baseline, emergency savings, primary goal
- Guided stage-order suggestion logic:
  - income → fixed obligations/essentials → debt floor/target → savings target → living/discretionary allocation
- Health state output: `balanced|tight|deficit`
- Lifecycle metadata output: `suggested/edited/accepted/active`
- Accept flow projects allocations into legacy `budgets` for dashboard compatibility
- Frontend guard blocks dashboard until onboarding completion

### 5.7 AI Advisor + Action Confirmation
- `/ai/query`, `/ai/voice`
- Structured context bands (`confirmed/predicted/uncertain`) with provenance and quality flags
- All-time context enrichment (lifetime totals, trend, merchants, goals, recent txns)
- Action proposal extraction marker: `[ACTION_PROPOSAL_JSON]`
- Proposal persistence in `ai_action_requests`
- `/ai/actions/confirm` with ownership, pending-state, and expiry enforcement
- Chat UI confirmation cards with confirm/reject flows

### 5.8 Forecasting
- Backend builds monthly history payload from transactions
- ML personalized endpoint `/ml/forecast/personalized`
- Horizons: `1/3/6`
- Reliability metadata: confidence/fallback mode/quality flags
- Sparse-history fallbacks (`no_history_profile_default`, `one_or_two_months`, `limited_history_weighted`)

### 5.9 Anomaly Lifecycle
- Persisted anomalies with `active|read|dismissed|resolved`
- APIs for list/summary/transaction-linked fetch/status transitions
- Dashboard + transactions/import anomaly awareness
- Fail-open behavior for anomaly subsystem errors during writes

### 5.10 Stocks Module
- Auth-protected `/stocks` APIs
- Dashboard stocks UI: profile/overview/indicators/fundamentals + AI insights
- Provider split + normalization + fail-open fallbacks
- Insight generation uses advisor LLM pipeline with strict JSON parsing/coercion

---

## 6) AI/ML Models Used (Exact)

### 6.1 LLM models in backend
- Provider: EcomAgent-compatible chat completions
- Default model: `claude-opus-4.6`
- Config key: `ECOMAGENT_MODEL` (optional override)
- Used in:
  - `/ai/query`
  - `/ai/voice`
  - `/stocks/:ticker/insights`

### 6.2 Production transaction categorization model
`ml/models/training_metrics.json` (current artifact):
- `selected_classifier`: `CalibratedClassifierCV(LinearSVC)`
- `accuracy`: `0.9472786885245902`
- `macro_f1`: `0.9501687456975427`
- `training_samples`: `38125`
- `model_version`: `feedback-2026-04-12T20-56-16-905Z`

Training candidates in `ml/train.py`:
- Calibrated LinearSVC pipeline
- Logistic Regression pipeline

Selection rule:
- Logistic is selected only if macro-F1 exceeds LinearSVC by > `0.02`.
- Otherwise calibrated LinearSVC remains selected.

### 6.3 Deterministic rule model layer
- `ml/rules/merchant_rules.py` executes first.
- Rule matches return category with confidence 1.0 and `source = rule`.

### 6.4 Forecast model
- `ml/forecasting/personalized_forecaster.py`
- Weighted-trend deterministic forecaster with explicit fallback and reliability modes.

---

## 7) Notebook Benchmark: `ml/notebooks/transaction_model_comparison.ipynb`

Notebook design goals:
- Compare multiple model families for category classification.
- Keep production model untouched.
- Rank by macro-F1.

Observed ranking output (top-to-bottom by macro-F1):
1. TF-IDF + LinearSVC — macro_f1 `0.735124`, weighted_f1 `0.921068`, accuracy `0.920075`
2. Character TF-IDF + LinearSVC — macro_f1 `0.735042`
3. Word + Character TF-IDF + LinearSVC — macro_f1 `0.727048`
4. Hybrid Text+Amount+Type+Channel+SourceBank (LogReg) — macro_f1 `0.722984`
5. TF-IDF + Logistic Regression — macro_f1 `0.722821`
6. TF-IDF + SGD (hinge) — macro_f1 `0.720481`
7. TF-IDF + SGD (log_loss) — macro_f1 `0.711022`
8. TF-IDF + Calibrated LinearSVC — macro_f1 `0.700441`
9. TF-IDF + Random Forest — macro_f1 `0.679097`
10. TF-IDF + XGBoost — macro_f1 `0.648561`
11. TF-IDF + Complement Naive Bayes — macro_f1 `0.645730`
12. Rule + Best ML Fallback Hybrid — macro_f1 `0.602905`
13. Rule-based Categorizer — macro_f1 `0.089779`

Notebook final recommendation output:
- Best notebook model: `TF-IDF + LinearSVC`
- Hybrid rule+ML fallback did not outperform the best pure ML in that run (`0.6029` vs `0.7351` macro-F1)
- Recommendation: retrain on merged historical + new labeled statement data

Important thesis interpretation:
- Notebook benchmark winner and deployed production model are different evaluation contexts.
- Production pipeline currently deploys calibrated LinearSVC artifact with stronger recorded production-training metrics.

---

## 8) Backend API Surface

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/password`

### Onboarding
- `GET /onboarding/status`
- `GET /onboarding/budget-plan`
- `POST /onboarding/budget-plan/preview`
- `PUT /onboarding/budget-plan`
- `POST /onboarding/budget-plan/accept`

### Transactions
- `POST /transactions`
- `POST /transactions/batch`
- `GET /transactions`
- `PUT /transactions/:id`
- `DELETE /transactions/:id`
- `POST /transactions/import/preview`
- `GET /transactions/import/:sessionId`
- `POST /transactions/import/confirm`

### Dashboard / Budgets / Goals / Suggestions
- `GET /dashboard/summary`
- `POST /budgets`
- `GET /budgets`
- `POST /goals`
- `GET /goals`
- `PUT /goals/:id`
- `DELETE /goals/:id`
- `GET /suggestions`
- `POST /suggestions/refresh`
- `PATCH /suggestions/:id/read`

### AI / Forecast / Anomalies / Stocks
- `POST /ai/query`
- `POST /ai/voice`
- `POST /ai/actions/confirm`
- `GET /forecast/history/:userId`
- `GET /forecast/internal/history/:userId`
- `GET /anomalies`
- `GET /anomalies/summary`
- `GET /anomalies/transactions/:id`
- `PATCH /anomalies/:id/read`
- `PATCH /anomalies/:id/dismiss`
- `GET /stocks/search`
- `GET /stocks/:ticker/profile`
- `GET /stocks/:ticker/overview`
- `GET /stocks/:ticker/indicators`
- `GET /stocks/:ticker/fundamentals`
- `POST /stocks/:ticker/insights`

---

## 9) ML API Surface

- `GET /health`
- `POST /ml/categorize`
- `POST /ml/categorize/batch`
- `POST /ml/extract/statement`
- `GET /ml/forecast/:userId`
- `POST /ml/forecast/personalized`
- `GET /ml/stocks/profile/{ticker}`
- `GET /ml/stocks/fundamentals/{ticker}?statement=income|balance|cashflow`

---

## 10) Database Footprint (High-Level)

- `users`
- `categories`
- `transactions`
- `import_sessions`
- `import_session_rows`
- `budgets`
- `budget_plans`
- `budget_plan_allocations`
- `goals`
- `suggestions`
- `ai_logs`
- `ai_action_requests`
- `anomalies`
- `merchant_category_rules`
- `merchant_pattern_memory`
- `category_feedback_events`
- `password_reset_tokens`
- `support_requests`
- `user_notification_settings`
- `user_security_settings`

---

## 11) Reliability, Security, Observability

Implemented:
- DB-backed token-version auth enforcement
- Password reset token lifecycle with one-time hashed tokens
- Auth route rate limits + CORS allowlist
- Deterministic tests for import/budgets/AI/stocks
- Deterministic ML parser + Textract adapter tests
- Structured observability events + correlation-id propagation
- Fail-open behavior where non-critical dependencies fail

---

## 12) Frontend Surface (Implemented)

Public/auth:
- `/login`
- `/register`
- `/onboarding/budget-plan`

Dashboard:
- `/dashboard`
- `/dashboard/transactions`
- `/dashboard/goals`
- `/dashboard/chat`
- `/dashboard/voice`
- `/dashboard/stocks`

Key behavior:
- onboarding-aware auth provider state refresh
- onboarding-required redirect guard before dashboard access
- import review UX with additive confirm metadata handling
- AI action confirmation cards in chat

---

## 13) Tests and Scripts

Backend scripts (`backend/package.json`):
- `npm run test:import`
- `npm run test:budgets`
- `npm run test:ai`
- `npm run test:stocks`
- `npm run export:feedback`
- `npm run retrain:feedback`
- `npm run smoke:forecast`
- `npm run smoke:anomaly`
- `npm run smoke:ai-context`
- `npm run smoke:import-textract`
- `npm run smoke:stocks`
- `npm run smoke:ai-actions`

ML tests:
- `python -m unittest import_engine.test_parser_matrix`
- `python -m unittest import_engine.test_textract_adapter`

---

## 14) Local Runbook

```bash
# backend
cd backend && npm run dev

# ml
cd ml && uvicorn main:app --reload --port 8000

# frontend
cd frontend && npm run dev
```

Local URLs:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- ML: `http://localhost:8000`

---

## 15) Environment Variables (Key)

Backend (`backend/.env`):
- `PORT`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`
- `ML_SERVICE_URL`
- `ECOMAGENT_API_KEY`
- `ECOMAGENT_BASE_URL` (optional)
- `ECOMAGENT_MODEL` (optional)
- `CORS_ALLOWED_ORIGINS`
- `AUTH_ENFORCE_TOKEN_VERSION`
- provider keys for stocks/import extraction as enabled

Frontend (`frontend/.env.local`):
- `NEXT_PUBLIC_API_URL`

ML (`ml/.env`):
- `PORT` (+ extraction/provider configuration)

Never commit secrets.

---

## 16) Remaining Work (Future Work)

Implementation is feature-complete for declared phases; remaining work is mostly operational hardening:
1. broader onboarding/auth invalidation E2E integration coverage,
2. anomaly-noise calibration depth,
3. expanded OCR/statement fixture corpus,
4. centralized telemetry sink + alerts,
5. production secret-rotation/deployment runbooks,
6. optional UX controls (anomaly muting/batch dismissal).

---

## 17) Thesis Guidance

For thesis/report drafting with Claude, use:
- this file,
- `docs/progress.md`,
- `docs/PROJECT_MASTER_SUMMARY.md`,
- direct code verification in referenced files.

Must-do writing constraints:
- separate notebook experiments from production model truth,
- keep model claims evidence-backed,
- do not claim unverified production rollout/scale benchmarks,
- explicitly include limits/future work.

---

## 18) High-Value Evidence Files

Backend:
- `backend/controllers/authController.js`
- `backend/controllers/onboardingController.js`
- `backend/controllers/dashboardController.js`
- `backend/controllers/transactionController.js`
- `backend/controllers/transactionImportController.js`
- `backend/services/budgets/suggestedPlanService.js`
- `backend/services/budgets/planWriteService.js`
- `backend/services/budgetService.js`
- `backend/services/import/importPipelineService.js`
- `backend/services/import/categorizationService.js`
- `backend/services/transactions/transactionWriteService.js`
- `backend/services/transactions/feedbackLearningService.js`
- `backend/services/transactions/merchantPatternMemoryService.js`
- `backend/services/transactions/merchantCategoryRuleService.js`
- `backend/services/anomalies/anomalyOrchestratorService.js`
- `backend/services/advisorService.js`
- `backend/services/stocks/stockInsightsService.js`
- `backend/db/migrate.js`

Frontend:
- `frontend/components/providers/auth-provider.tsx`
- `frontend/components/auth-guard.tsx`
- `frontend/app/onboarding/budget-plan/page.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/transactions/page.tsx`
- `frontend/app/dashboard/chat/page.tsx`
- `frontend/app/dashboard/voice/page.tsx`
- `frontend/app/dashboard/stocks/page.tsx`

ML:
- `ml/main.py`
- `ml/categorizer.py`
- `ml/train.py`
- `ml/rules/merchant_rules.py`
- `ml/forecasting/personalized_forecaster.py`
- `ml/import_engine/pipeline.py`
- `ml/models/training_metrics.json`
- `ml/notebooks/transaction_model_comparison.ipynb`

---

## 19) Non-Negotiable Quality Rules

- Never fabricate implementation status.
- Never infer missing metrics as facts.
- Never mark a feature complete unless route/service wiring exists in code.
- Always distinguish experiment outputs from deployed artifact metrics.
- Keep backward-compatible behaviors explicit when describing architecture changes.
