// ── Admin Type Definitions ─────────────────────────────────────────────────────

export type AdminUser = {
  user_id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  monthly_income: number;
  city: string | null;
  occupation: string | null;
  created_at: string;
};

// ── Overview ─────────────────────────────────────────────────────────────────

export type AdminOverviewStats = {
  total_users: number;
  active_users_30d: number;
  total_transactions: number;
  total_import_sessions: number;
  active_anomalies: number;
  open_support_tickets: number;
};

export type AdminMlHealth = {
  status: 'ok' | 'degraded' | 'offline' | 'unknown';
  latency_ms: number | null;
  last_check: string | null;
};

export type AdminOverview = {
  stats: AdminOverviewStats;
  recent_users: AdminUser[];
  recent_transactions: AdminTransactionRow[];
  recent_import_sessions: AdminImportSessionRow[];
  recent_support: AdminSupportRow[];
  ml_health: AdminMlHealth;
};

// ── Pagination ───────────────────────────────────────────────────────────────

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

// ── Users ─────────────────────────────────────────────────────────────────────

export type AdminUserRow = {
  user_id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  monthly_income: string | number;
  city: string | null;
  occupation: string | null;
  created_at: string;
  transaction_count: number;
  support_count: number;
};

export type AdminUserDetail = {
  user: AdminUser & { phone: string | null; bio: string | null; avatar_url: string | null };
  transaction_summary: {
    count: number;
    total_income: string | number;
    total_expenses: string | number;
    savings_rate: string | number | null;
  };
  budgets: AdminBudgetRow[];
  goals: AdminGoalRow[];
  import_sessions: AdminImportSessionRow[];
  ai_query_count: number;
  support_count: number;
  active_anomaly_count: number;
};

export type AdminUsersResponse = {
  users: AdminUserRow[];
} & PaginationMeta;

// ── Transactions ──────────────────────────────────────────────────────────────

export type AdminTransactionRow = {
  transaction_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  description: string;
  merchant: string | null;
  amount: string | number;
  type: 'income' | 'expense';
  date: string;
  status: string;
  source: string;
  ml_confidence: string | number | null;
  category_name: string | null;
  created_at: string;
};

export type AdminTransactionDetail = AdminTransactionRow & {
  notes: string | null;
  updated_at: string;
  category_id: number | null;
  category_icon: string | null;
  category_color: string | null;
};

export type AdminTransactionsResponse = {
  transactions: AdminTransactionRow[];
} & PaginationMeta;

// ── Import Sessions ────────────────────────────────────────────────────────────

export type AdminImportSessionRow = {
  import_session_id: string;
  user_id: number;
  user_name: string;
  user_email?: string;
  file_name: string;
  source_type: string;
  source_bank: string;
  parser_name: string | null;
  state: string;
  detection_confidence: number | null;
  warnings: unknown[];
  created_at: string;
  row_count?: number;
  total_rows?: number;
  accepted_rows?: number;
  needs_review_rows?: number;
};

export type AdminImportSessionDetail = {
  session: AdminImportSessionRow & {
    mime_type: string;
    summary: Record<string, unknown>;
    updated_at: string;
  };
  rows: AdminImportRow[];
};

export type AdminImportRow = {
  row_index: number;
  description: string | null;
  merchant: string | null;
  amount: string | number | null;
  direction: string | null;
  type: string | null;
  needs_review: boolean;
  dedupe_status: string;
  duplicate_reason: string | null;
  top_predictions: { category: string; confidence: number }[];
  is_excluded: boolean;
  extraction_confidence: number | null;
  created_at: string;
};

export type AdminImportSessionsResponse = {
  sessions: AdminImportSessionRow[];
} & PaginationMeta;

export type AdminImportRowsResponse = {
  rows: AdminImportRow[];
} & PaginationMeta;

// ── Categorization Review ─────────────────────────────────────────────────────

export type AdminFeedbackEvent = {
  feedback_event_id: number;
  user_id: number;
  user_name: string;
  feedback_kind: string;
  merchant: string | null;
  predicted_category_name: string | null;
  final_category_name: string | null;
  predicted_confidence: number | null;
  amount: string | number | null;
  direction: string | null;
  model_version: string | null;
  created_at: string;
  transaction_id: number | null;
  import_session_id: string | null;
  row_index: number | null;
};

export type AdminCategorizationReviewResponse = {
  events: AdminFeedbackEvent[];
} & PaginationMeta;

// ── Budgets & Goals ──────────────────────────────────────────────────────────

export type AdminBudgetRow = {
  budget_id: number;
  user_id: number;
  user_name?: string;
  category_id: number;
  category_name: string;
  monthly_limit: string | number;
  month: number;
  year: number;
  spent?: string | number;
  utilization_pct?: string | number;
};

export type AdminGoalRow = {
  goal_id: number;
  user_id: number;
  user_name?: string;
  title: string;
  target_amount: string | number;
  current_savings: string | number;
  category_id: number | null;
  category_name: string | null;
  deadline: string | null;
  status: string;
  created_at: string;
};

export type AdminBudgetsGoalsResponse = {
  summary: {
    total_budgets: number;
    active_goals: number;
    over_budget_users: number;
    avg_savings_rate: string | number;
  };
  budgets: AdminBudgetRow[];
} & PaginationMeta;

// ── Forecasting ────────────────────────────────────────────────────────────────

export type AdminForecastUser = {
  user_id: number;
  name: string;
  monthly_income: string | number;
  months_of_history: number;
  transaction_count: number;
};

export type AdminMonthlyAggregate = {
  user_id: number;
  year: number;
  month: number;
  total_income: string | number;
  total_expenses: string | number;
};

export type AdminForecastingResponse = {
  ml_service_status: string;
  users: AdminForecastUser[];
  monthly_aggregates: AdminMonthlyAggregate[];
} & PaginationMeta;

// ── Anomalies ─────────────────────────────────────────────────────────────────

export type AdminAnomalyRow = {
  anomaly_id: number;
  user_id: number;
  user_name: string;
  anomaly_type: string;
  scope: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  explanation: string;
  status: string;
  year: number | null;
  month: number | null;
  transaction_id: number | null;
  created_at: string;
  updated_at: string;
};

export type AdminAnomaliesResponse = {
  anomalies: AdminAnomalyRow[];
  summary: { active: number; high: number; medium: number; low: number };
} & PaginationMeta;

// ── AI Logs ──────────────────────────────────────────────────────────────────

export type AdminAiLogRow = {
  log_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  input_text: string;
  response_text: string;
  channel: string;
  created_at: string;
};

export type AdminAiLogsResponse = {
  logs: AdminAiLogRow[];
} & PaginationMeta;

// ── Support ──────────────────────────────────────────────────────────────────

export type AdminSupportRow = {
  support_request_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  subject: string;
  status: string;
  created_at: string;
};

export type AdminSupportDetail = AdminSupportRow & {
  message: string;
};

export type AdminSupportResponse = {
  requests: AdminSupportRow[];
  summary: { open: number; in_progress: number; resolved: number };
} & PaginationMeta;

// ── ML Health ────────────────────────────────────────────────────────────────

export type AdminMlEndpointHealth = {
  status: 'ok' | 'error' | 'offline';
  status_code?: number;
  latency_ms: number | null;
  error?: string;
  last_check: string | null;
};

export type AdminMlHealthResponse = {
  status: 'ok' | 'degraded' | 'offline';
  endpoints: Record<string, AdminMlEndpointHealth>;
};

// ── System Health ─────────────────────────────────────────────────────────────

export type AdminSystemHealthResponse = {
  backend: { status: string; uptime_s: number; db_ping_ms: number; version: string };
  db: { status: string; connection_count: number };
  ml: { status: string; latency_ms: number | null };
  env_sanity: Record<string, boolean>;
  server_time: string;
  node_version: string;
};

// ── Audit Logs ───────────────────────────────────────────────────────────────

export type AdminAuditLogRow = {
  audit_log_id: number;
  actor_user_id: number | null;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  response_status: number | null;
  created_at: string;
};

export type AdminAuditLogsResponse = {
  logs: AdminAuditLogRow[];
} & PaginationMeta;

// ── Categories (for dropdowns) ───────────────────────────────────────────────

export type Category = {
  category_id: number;
  name: string;
  type: string;
  icon: string | null;
  color: string | null;
};