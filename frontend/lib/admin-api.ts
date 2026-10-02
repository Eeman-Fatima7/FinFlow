import { apiRequest } from '@/lib/api';
import type {
  AdminOverview,
  AdminUsersResponse,
  AdminUserDetail,
  AdminTransactionsResponse,
  AdminTransactionDetail,
  AdminImportSessionsResponse,
  AdminImportSessionDetail,
  AdminImportRowsResponse,
  AdminCategorizationReviewResponse,
  AdminBudgetsGoalsResponse,
  AdminForecastingResponse,
  AdminAnomaliesResponse,
  AdminAiLogsResponse,
  AdminSupportResponse,
  AdminSupportDetail,
  AdminMlHealthResponse,
  AdminSystemHealthResponse,
  AdminAuditLogsResponse,
  Category,
} from './admin-types';

type QueryParams = Record<string, string | number | boolean | null | undefined>;

// ── Overview ───────────────────────────────────────────────────────────────

export const adminGetOverview = () =>
  apiRequest<AdminOverview>('/admin/overview', { auth: true });

// ── Users ─────────────────────────────────────────────────────────────────────

export const adminListUsers = (params?: QueryParams) =>
  apiRequest<AdminUsersResponse>('/admin/users', { auth: true, query: params });

export const adminGetUser = (id: number) =>
  apiRequest<AdminUserDetail>(`/admin/users/${id}`, { auth: true });

export const adminPatchUser = (id: number, body: { role?: string; status?: string }) =>
  apiRequest<{ message: string }>(`/admin/users/${id}`, {
    auth: true,
    method: 'PATCH',
    body: JSON.stringify(body),
  });

// ── Transactions ─────────────────────────────────────────────────────────────

export const adminListTransactions = (params?: QueryParams) =>
  apiRequest<AdminTransactionsResponse>('/admin/transactions', { auth: true, query: params });

export const adminGetTransaction = (id: number) =>
  apiRequest<{ transaction: AdminTransactionDetail }>(`/admin/transactions/${id}`, { auth: true });

export const adminPatchTransactionCategory = (id: number, categoryId: number) =>
  apiRequest<{ message: string }>(`/admin/transactions/${id}/category`, {
    auth: true,
    method: 'PATCH',
    body: JSON.stringify({ category_id: categoryId }),
  });

// ── Import Sessions ─────────────────────────────────────────────────────────

export const adminListImportSessions = (params?: QueryParams) =>
  apiRequest<AdminImportSessionsResponse>('/admin/import-sessions', { auth: true, query: params });

export const adminGetImportSession = (id: string) =>
  apiRequest<AdminImportSessionDetail>(`/admin/import-sessions/${id}`, { auth: true });

export const adminGetImportSessionRows = (id: string, params?: QueryParams) =>
  apiRequest<AdminImportRowsResponse>(`/admin/import-sessions/${id}/rows`, { auth: true, query: params });

// ── Categorization Review ───────────────────────────────────────────────────

export const adminListCategorizationReview = (params?: QueryParams) =>
  apiRequest<AdminCategorizationReviewResponse>('/admin/categorization-review', { auth: true, query: params });

export const adminApproveCategorization = (eventId: number) =>
  apiRequest<{ message: string }>(`/admin/categorization-review/${eventId}/approve`, {
    auth: true,
    method: 'POST',
  });

export const adminCorrectCategorization = (eventId: number, categoryId: number) =>
  apiRequest<{ message: string }>(`/admin/categorization-review/${eventId}/correct`, {
    auth: true,
    method: 'POST',
    body: JSON.stringify({ category_id: categoryId }),
  });

// ── Budgets & Goals ─────────────────────────────────────────────────────────

export const adminGetBudgetsGoals = (params?: QueryParams) =>
  apiRequest<AdminBudgetsGoalsResponse>('/admin/budgets-goals', { auth: true, query: params });

// ── Forecasting ─────────────────────────────────────────────────────────────

export const adminGetForecasting = (params?: QueryParams) =>
  apiRequest<AdminForecastingResponse>('/admin/forecasting', { auth: true, query: params });

// ── Anomalies ───────────────────────────────────────────────────────────────

export const adminListAnomalies = (params?: QueryParams) =>
  apiRequest<AdminAnomaliesResponse>('/admin/anomalies', { auth: true, query: params });

export const adminPatchAnomalyStatus = (id: number, status: string) =>
  apiRequest<{ message: string }>(`/admin/anomalies/${id}/review`, {
    auth: true,
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

// ── AI / Voice Logs ─────────────────────────────────────────────────────────

export const adminListAiLogs = (params?: QueryParams) =>
  apiRequest<AdminAiLogsResponse>('/admin/ai-logs', { auth: true, query: params });

export const adminListVoiceLogs = (params?: QueryParams) =>
  apiRequest<AdminAiLogsResponse>('/admin/voice-logs', { auth: true, query: params });

// ── Support ─────────────────────────────────────────────────────────────────

export const adminListSupport = (params?: QueryParams) =>
  apiRequest<AdminSupportResponse>('/admin/support', { auth: true, query: params });

export const adminGetSupport = (id: number) =>
  apiRequest<{ request: AdminSupportDetail }>(`/admin/support/${id}`, { auth: true });

export const adminPatchSupport = (id: number, body: { status?: string; admin_note?: string }) =>
  apiRequest<{ message: string }>(`/admin/support/${id}`, {
    auth: true,
    method: 'PATCH',
    body: JSON.stringify(body),
  });

// ── ML + System Health ──────────────────────────────────────────────────────

export const adminGetMlHealth = () =>
  apiRequest<AdminMlHealthResponse>('/admin/ml-health', { auth: true });

export const adminGetSystemHealth = () =>
  apiRequest<AdminSystemHealthResponse>('/admin/system-health', { auth: true });

// ── Audit Logs ─────────────────────────────────────────────────────────────

export const adminListAuditLogs = (params?: QueryParams) =>
  apiRequest<AdminAuditLogsResponse>('/admin/audit-logs', { auth: true, query: params });

// ── Categories (shared) ────────────────────────────────────────────────────

export const getCategories = () =>
  apiRequest<Category[]>('/categories', { auth: true });