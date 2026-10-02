export type AnomalySeverity = 'low' | 'medium' | 'high' | string;

export type ApiAnomaly = {
  anomaly_id: number;
  user_id?: number;
  transaction_id: number | null;
  anomaly_type: string;
  scope: 'transaction' | 'month' | string;
  severity: AnomalySeverity;
  title: string;
  explanation: string;
  evidence?: Record<string, unknown>;
  status?: 'active' | 'read' | 'dismissed' | 'resolved' | string;
  year?: number | null;
  month?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type AnomalySummary = {
  total_active: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  highlights: ApiAnomaly[];
};

export const anomalySeverityRank = (severity: AnomalySeverity): number => {
  const normalized = String(severity || '').toLowerCase();
  if (normalized === 'high') return 0;
  if (normalized === 'medium') return 1;
  if (normalized === 'low') return 2;
  return 99;
};
