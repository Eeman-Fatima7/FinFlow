export type ImportPrediction = {
  category: string;
  confidence: number;
};

export type ImportReviewPayload = {
  transaction_date?: string | null;
  description?: string | null;
  merchant?: string | null;
  amount?: number | null;
  direction?: string | null;
  category_final?: string | null;
  extracted_category?: string | null;
  ml_predicted_category?: string | null;
  ml_confidence?: number | null;
  ml_source?: string | null;
  ml_margin?: number | null;
  ml_ambiguous?: boolean | null;
  model_version?: string | null;
  category_touched?: boolean | null;
  top_predictions?: ImportPrediction[];
  warnings?: string[];
  source_bank?: string | null;
  status?: string | null;
  notes?: string | null;
};

export type ImportPreviewRow = {
  row_index: number;
  review_payload: ImportReviewPayload;
  needs_review: boolean;
  dedupe_status: string;
  duplicate_reason?: string | null;
  top_predictions?: ImportPrediction[];
  is_excluded: boolean;
};

export type ImportPreviewResponse = {
  session_id: string;
  state: string;
  source_type: string;
  source_bank: string;
  parser_name: string;
  detection_confidence: number | null;
  extraction_provider?: string | null;
  pages_processed?: number | null;
  warnings: string[];
  summary: Record<string, unknown>;
  rows: ImportPreviewRow[];
};

export type ImportRowPatch = Partial<{
  transaction_date: string;
  description: string;
  merchant: string;
  amount: number;
  type: 'income' | 'expense';
  category_final: string;
  category_touched: boolean;
  status: string;
  notes: string;
}>;

export type ImportConfirmUpdate = {
  row_index: number;
  action: 'update' | 'remove' | 'restore';
  patch?: ImportRowPatch;
};

export type ImportConfirmResponse = {
  session_id: string;
  state: string;
  total_candidates: number;
  accepted_candidates: number;
  created_count: number;
  failed_count: number;
  blocked_duplicates: number;
  validation_blocked?: number;
  duplicate_blocks: Array<{ row_index: number; reason: string }>;
  validation_blocks?: Array<{
    row_index: number | null;
    field: string;
    reason: string;
  }>;
  created_row_indexes?: number[];
  errors: Array<{ index: number; row_index?: number | null; error: string }>;
  anomalies?: Array<{
    anomaly_id: number;
    transaction_id: number | null;
    anomaly_type: string;
    scope: 'transaction' | 'month' | string;
    severity: 'low' | 'medium' | 'high' | string;
    title: string;
    explanation: string;
    evidence?: Record<string, unknown>;
    status?: 'active' | 'read' | 'dismissed' | 'resolved' | string;
    year?: number | null;
    month?: number | null;
    created_at?: string;
    updated_at?: string;
  }>;
};
