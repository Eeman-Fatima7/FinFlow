"use client";

import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import type { ImportPrediction, ImportPreviewRow, ImportRowPatch } from "@/lib/import-types";

type ImportReviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ImportPreviewRow[];
  categoryOptions?: string[];
  onChangeRow: (rowIndex: number, patch: ImportRowPatch) => void;
  onToggleExclude: (rowIndex: number, excluded: boolean) => void;
  onConfirm: () => void;
  confirming: boolean;
  recentAnomalies?: Array<{
    anomaly_id: number;
    severity: string;
    title: string;
    explanation: string;
  }>;
};

const inferAmbiguity = (
  explicitAmbiguous: boolean | null | undefined,
  topPredictions: ImportPrediction[]
): boolean => {
  if (explicitAmbiguous === true) return true;
  if (explicitAmbiguous === false) return false;
  if (topPredictions.length < 2) return false;

  const margin = Number(topPredictions[0]?.confidence || 0) - Number(topPredictions[1]?.confidence || 0);
  return Number.isFinite(margin) && margin < 0.08;
};

const resolveType = (direction?: string | null): "income" | "expense" => {
  const normalized = (direction || "").toLowerCase();
  return normalized === "credit" || normalized === "income" ? "income" : "expense";
};

const parseConfidence = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Math.round(Number(value) * 100);
};

const TAXONOMY_CATEGORIES = [
  "Income",
  "Transfers",
  "Bills",
  "Groceries",
  "Food & Dining",
  "Transport",
  "Shopping",
  "Subscriptions",
  "Entertainment",
  "Healthcare",
  "Education",
  "Charity",
  "Fees & Charges",
  "Cash Withdrawal",
  "Government/Legal",
  "Other",
];

const normalizePrediction = (prediction: ImportPrediction | null | undefined): ImportPrediction | null => {
  if (!prediction || typeof prediction !== "object") return null;
  const category = typeof prediction.category === "string" ? prediction.category.trim() : "";
  const confidence = Number(prediction.confidence);
  if (!category || !Number.isFinite(confidence)) return null;
  return { category, confidence };
};

const getConfidenceBadgeClass = (confidence: number | null, source?: string | null) => {
  const normalizedSource = (source || "").toLowerCase();
  if (normalizedSource === "rule" || confidence === null || confidence >= 85) {
    return "bg-green-100 text-green-800";
  }
  if (confidence >= 60) {
    return "bg-yellow-100 text-yellow-800";
  }
  return "bg-red-100 text-red-800";
};

export function ImportReviewModal({
  open,
  onOpenChange,
  rows,
  categoryOptions,
  onChangeRow,
  onToggleExclude,
  onConfirm,
  confirming,
  recentAnomalies = [],
}: ImportReviewModalProps) {
  const [manuallyCorrected, setManuallyCorrected] = useState<Record<number, boolean>>({});

  const activeRowIndexes = useMemo(() => new Set(rows.map((row) => row.row_index)), [rows]);

  const visibleManualCorrections = useMemo(() => {
    if (!open) return {} as Record<number, boolean>;

    const next: Record<number, boolean> = {};
    Object.entries(manuallyCorrected).forEach(([key, corrected]) => {
      const rowIndex = Number(key);
      if (corrected && activeRowIndexes.has(rowIndex)) {
        next[rowIndex] = true;
      }
    });
    return next;
  }, [open, manuallyCorrected, activeRowIndexes]);

  const handleCategoryChange = (rowIndex: number, nextCategory: string) => {
    onChangeRow(rowIndex, {
      category_final: nextCategory,
      category_touched: true,
    });
    setManuallyCorrected((prev) => ({ ...prev, [rowIndex]: true }));
  };

  const summary = useMemo(() => {
    const included = rows.filter((row) => !row.is_excluded);
    const reviewRequired = included.filter((row) => row.needs_review).length;
    const exactBlocked = included.filter((row) => row.dedupe_status === "blocked_exact").length;
    const probableDuplicates = included.filter((row) => row.dedupe_status === "probable_duplicate").length;

    return {
      total: rows.length,
      included: included.length,
      excluded: rows.length - included.length,
      reviewRequired,
      exactBlocked,
      probableDuplicates,
    };
  }, [rows]);

  const handleSheetOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setManuallyCorrected({});
    }
    onOpenChange(nextOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="w-full sm:max-w-[1000px] p-0 flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden">
        <div className="shrink-0 border-b px-6 pt-6 pb-4 bg-background">
          <SheetHeader>
            <SheetTitle>Review Imported Transactions</SheetTitle>
            <SheetDescription>
              Edit rows, remove duplicates, and confirm import.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary">Total: {summary.total}</Badge>
            <Badge variant="secondary">Included: {summary.included}</Badge>
            <Badge variant="secondary">Excluded: {summary.excluded}</Badge>
            <Badge variant="secondary">Needs review: {summary.reviewRequired}</Badge>
            {summary.probableDuplicates > 0 && (
              <Badge variant="secondary">Probable duplicates: {summary.probableDuplicates}</Badge>
            )}
            {summary.exactBlocked > 0 && <Badge variant="destructive">Blocked duplicates: {summary.exactBlocked}</Badge>}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          {rows.map((row) => {
            const review = row.review_payload || {};
            const amount = Number(review.amount || 0);
            const type = resolveType(review.direction);
            const confidence = parseConfidence(review.ml_confidence);
            const warnings = Array.isArray(review.warnings) ? review.warnings : [];
            const rawPredictions =
              Array.isArray(review.top_predictions) && review.top_predictions.length > 0
                ? review.top_predictions
                : Array.isArray(row.top_predictions)
                  ? row.top_predictions
                  : [];
            const topPredictions = rawPredictions
              .map((prediction) => normalizePrediction(prediction))
              .filter((prediction): prediction is ImportPrediction => Boolean(prediction));

            const selectedCategory =
              review.category_final || review.extracted_category || review.ml_predicted_category || "";

            const predictionOptions = topPredictions
              .map((prediction) => prediction.category)
              .filter((category) => category && category !== selectedCategory)
              .filter((category, index, arr) => arr.indexOf(category) === index);

            const fullCategoryOptions =
              Array.isArray(categoryOptions) && categoryOptions.length > 0
                ? categoryOptions
                : TAXONOMY_CATEGORIES;
            const mergedCategoryOptions = [
              ...predictionOptions,
              ...fullCategoryOptions.filter((category) => !predictionOptions.includes(category)),
            ];

            const sourceLabel = (review.ml_source || "").toLowerCase();
            const isSavedRule = sourceLabel === "user_rule";
            const isEdited = Boolean(visibleManualCorrections[row.row_index]);
            const confidenceBadgeClass = getConfidenceBadgeClass(confidence, review.ml_source);
            const isAmbiguous = inferAmbiguity(review.ml_ambiguous, topPredictions);

            return (
              <div
                key={row.row_index}
                className={`rounded-2xl border p-4 space-y-4 ${
                  row.is_excluded
                    ? "opacity-60 bg-accent/20"
                    : row.needs_review
                      ? "bg-red-50 border-red-200 border-l-4 border-l-red-500"
                      : "bg-background"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">Row {row.row_index + 1}</span>
                    {row.needs_review && <Badge variant="secondary">Needs review</Badge>}
                    {isSavedRule && <Badge className="bg-blue-100 text-blue-800">Saved Rule</Badge>}
                    {isEdited && <Badge variant="outline">Edited</Badge>}
                    {confidence !== null && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${confidenceBadgeClass}`}>
                        Confidence {confidence}%
                      </span>
                    )}
                    {isAmbiguous && <Badge variant="secondary">Ambiguous</Badge>}
                    {row.dedupe_status === "blocked_exact" && <Badge variant="destructive">Exact duplicate</Badge>}
                    {row.dedupe_status === "probable_duplicate" && <Badge variant="secondary">Probable duplicate</Badge>}
                  </div>

                  <Button
                    variant={row.is_excluded ? "default" : "outline"}
                    size="sm"
                    className="rounded-xl"
                    onClick={() => onToggleExclude(row.row_index, !row.is_excluded)}
                  >
                    {row.is_excluded ? "Restore" : "Remove"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={review.transaction_date || ""}
                      onChange={(e) => onChangeRow(row.row_index, { transaction_date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1 lg:col-span-2">
                    <Label>Description</Label>
                    <Input
                      value={review.description || ""}
                      onChange={(e) => onChangeRow(row.row_index, { description: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Merchant</Label>
                    <Input
                      value={review.merchant || ""}
                      onChange={(e) => onChangeRow(row.row_index, { merchant: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={Number.isFinite(amount) ? String(Math.abs(amount)) : ""}
                      onChange={(e) => onChangeRow(row.row_index, { amount: Number(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Type</Label>
                    <select
                      value={type}
                      onChange={(e) => onChangeRow(row.row_index, { type: e.target.value as "income" | "expense" })}
                      className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label>Final category</Label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => {
                        handleCategoryChange(row.row_index, e.target.value);
                      }}
                      className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select category</option>
                      {predictionOptions.length > 0 && (
                        <>
                          <optgroup label="Suggestions">
                            {predictionOptions.map((category) => (
                              <option key={`suggestion-${row.row_index}-${category}`} value={category}>
                                {category}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="All categories">
                            {mergedCategoryOptions
                              .filter((category) => !predictionOptions.includes(category))
                              .map((category) => (
                                <option key={`all-${row.row_index}-${category}`} value={category}>
                                  {category}
                                </option>
                              ))}
                          </optgroup>
                        </>
                      )}
                      {predictionOptions.length === 0 &&
                        mergedCategoryOptions.map((category) => (
                          <option key={`all-${row.row_index}-${category}`} value={category}>
                            {category}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label>Status</Label>
                    <select
                      value={(review.status || "completed").toLowerCase()}
                      onChange={(e) => onChangeRow(row.row_index, { status: e.target.value })}
                      className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="completed">Completed</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>

                  <div className="space-y-1 lg:col-span-3">
                    <Label>Notes</Label>
                    <Input
                      value={review.notes || ""}
                      onChange={(e) => onChangeRow(row.row_index, { notes: e.target.value })}
                    />
                  </div>
                </div>

                {(row.duplicate_reason || warnings.length > 0 || confidence !== null) && (
                  <div className="rounded-xl bg-accent/40 p-3 space-y-1 text-xs text-foreground/80">
                    {row.duplicate_reason && <p>Duplicate: {row.duplicate_reason}</p>}
                    {confidence !== null && <p>ML confidence: {confidence}%</p>}
                    {typeof review.ml_margin === "number" && <p>Prediction margin: {Math.round(review.ml_margin * 100)}%</p>}
                    {isAmbiguous && <p>Prediction ambiguity: high (top categories are close)</p>}
                    {review.ml_source && <p>Prediction source: {review.ml_source}</p>}
                    {topPredictions.length > 0 && (
                      <p>
                        Top predictions:{' '}
                        {topPredictions
                          .map((prediction) => `${prediction.category} (${Math.round(Number(prediction.confidence || 0) * 100)}%)`)
                          .join(', ')}
                      </p>
                    )}
                    {warnings.map((warning, idx) => (
                      <p key={idx}>• {warning}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {rows.length === 0 && <p className="text-sm text-foreground/60">No rows available for review.</p>}

          {recentAnomalies.length > 0 && (
            <div className="rounded-2xl border p-4 space-y-3">
              <h4 className="text-sm font-semibold">Recent anomaly alerts after save</h4>
              {recentAnomalies.slice(0, 5).map((anomaly) => (
                <div key={anomaly.anomaly_id} className="rounded-xl border bg-accent/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{anomaly.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        String(anomaly.severity).toLowerCase() === 'high'
                          ? 'bg-red-100 text-red-700'
                          : String(anomaly.severity).toLowerCase() === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {String(anomaly.severity).toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-foreground/80">{anomaly.explanation}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t px-6 py-4 bg-background flex gap-3">
          <Button variant="outline" className="rounded-xl flex-1" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button
            className="rounded-xl flex-1"
            onClick={onConfirm}
            disabled={confirming || summary.included === 0}
          >
            {confirming ? "Saving..." : `Confirm Import (${summary.included})`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
