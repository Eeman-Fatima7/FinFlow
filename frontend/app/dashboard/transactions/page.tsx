'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  Download,
  Search,
  Filter,
  Calendar,
  Tag,
  DollarSign,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, apiRequest } from '@/lib/api';
import { formatMoney, getLocaleForLanguage, usePreferences } from '@/lib/preferences';
import type { ApiAnomaly } from '@/lib/anomaly-types';
import type {
  ImportConfirmResponse,
  ImportConfirmUpdate,
  ImportPreviewResponse,
  ImportRowPatch,
} from '@/lib/import-types';
import { getCategoryColor as resolveCategoryColor } from '@/lib/categories';
import { useCategories } from '@/components/providers/categories-provider';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ManualCashEntryModal } from '@/components/manual-cash-entry-modal';
import { ImportTransactionsModal } from '@/components/import-transactions-modal';
import { ImportReviewModal } from '@/components/import-review-modal';
import { EditTransactionModal } from '@/components/edit-transaction-modal';

type ApiPrediction = {
  category: string;
  confidence: number;
};

type ApiTransaction = {
  transaction_id: number;
  user_id: number;
  description: string;
  merchant: string | null;
  amount: string;
  type: 'income' | 'expense';
  date: string;
  category_id: number | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  notes: string | null;
  status: 'completed' | 'pending' | string;
  source: string | null;
  ml_confidence: string | null;
  top_predictions?: ApiPrediction[];
  created_at: string;
  updated_at: string | null;
};

type ApiCategory = {
  category_id: number;
  name: string;
  type: 'income' | 'expense' | string;
  icon: string | null;
  color: string | null;
};

type CategoriesResponse = {
  categories: ApiCategory[];
};

type DisplayTransaction = {
  id: number;
  date: string;
  dateIso: string | null;
  merchant: string;
  category: string;
  amount: number;
  status: string;
  color: string;
  source?: string;
  notes?: string;
  mlConfidence?: number | null;
  topPredictions?: ApiPrediction[];
  anomalies?: ApiAnomaly[];
};

type UpdateTransactionPayload = {
  id: number;
  merchant: string;
  category: string;
  amount: number;
  date: string;
  status: string;
  source?: string;
  notes?: string;
};

type EditableTransaction = {
  id: number;
  date: string;
  dateIso?: string | null;
  merchant: string;
  category: string;
  amount: number;
  status: string;
  source?: string;
  notes?: string;
};

type TransactionsResponse = {
  transactions: ApiTransaction[];
  total: number;
};

type DatePreset = '7d' | '30d' | '3m' | '1y' | 'all';


const toDateOnly = (value: string) => {
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) return dateOnlyMatch[0];

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDisplayDate = (date: string, locale: string) => {
  const normalized = toDateOnly(date);
  if (!normalized) return date;

  const [year, month, day] = normalized.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return date;

  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function TransactionsPage() {
  const { categories: allCategories, categoryMeta } = useCategories();
  const { preferences } = usePreferences();
  const locale = getLocaleForLanguage(preferences.language);
  const moneyFormatter = (value: number) =>
    formatMoney(Math.abs(value), preferences.currency, preferences.language);

  const [transactionsData, setTransactionsData] = useState<DisplayTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [selectedTransaction, setSelectedTransaction] = useState<DisplayTransaction | null>(null);
  const [transactionToEdit, setTransactionToEdit] = useState<DisplayTransaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<DisplayTransaction | null>(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importReviewOpen, setImportReviewOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewResponse | null>(null);
  const [importRowEdits, setImportRowEdits] = useState<Record<number, ImportConfirmUpdate>>({});
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [recentImportAnomalies, setRecentImportAnomalies] = useState<ApiAnomaly[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [draftFilters, setDraftFilters] = useState<{
    datePreset: DatePreset;
    minAmount: string;
    maxAmount: string;
  }>({
    datePreset: 'all',
    minAmount: '',
    maxAmount: '',
  });

  const [appliedFilters, setAppliedFilters] = useState(draftFilters);

  const fetchCategories = useCallback(async () => {
    try {
      const categoriesData = await apiRequest<CategoriesResponse>('/categories', {
        method: 'GET',
        auth: true,
      });

      setApiCategories(categoriesData.categories || []);
    } catch {
      setApiCategories([]);
    }
  }, []);


  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [data, anomalyPayload] = await Promise.all([
        apiRequest<TransactionsResponse>('/transactions', {
          method: 'GET',
          auth: true,
          query: { limit: 100, offset: 0 },
        }),
        apiRequest<{ anomalies: ApiAnomaly[] }>('/anomalies', {
          method: 'GET',
          auth: true,
          query: { status: 'active', limit: 500 },
        }).catch(() => ({ anomalies: [] })),
      ]);

      const anomalyMap = new Map<number, ApiAnomaly[]>();
      for (const anomaly of anomalyPayload.anomalies || []) {
        const transactionId = Number(anomaly.transaction_id);
        if (!Number.isInteger(transactionId) || transactionId <= 0) continue;

        const existing = anomalyMap.get(transactionId) || [];
        existing.push(anomaly);
        anomalyMap.set(transactionId, existing);
      }

      const mapped = data.transactions.map((txn) => {
        const numericAmount = Number(txn.amount);
        const signedAmount = txn.type === 'income' ? Math.abs(numericAmount) : -Math.abs(numericAmount);
        const merchant = txn.merchant || txn.description || 'Unknown';
        const category = txn.category_name || 'Other';

        const dateIso = toDateOnly(txn.date);

        return {
          id: txn.transaction_id,
          date: toDisplayDate(txn.date, locale),
          dateIso,
          merchant,
          category,
          amount: signedAmount,
          status: (txn.status || 'completed').toLowerCase(),
          color: resolveCategoryColor(category, categoryMeta),
          source: txn.source || 'Bank',
          notes: txn.notes || undefined,
          mlConfidence: txn.ml_confidence === null ? null : Number(txn.ml_confidence),
          topPredictions: Array.isArray(txn.top_predictions) ? txn.top_predictions : [],
          anomalies: anomalyMap.get(txn.transaction_id) || [],
        } satisfies DisplayTransaction;
      });

      setTransactionsData(mapped);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load transactions');
      }
    } finally {
      setLoading(false);
    }
  }, [categoryMeta, locale]);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);


  const handleAddCashTransaction = async (payload: {
    type: 'expense' | 'income';
    amount: number;
    merchant: string;
    category: string;
    date: string;
    notes?: string;
  }) => {
    try {
      const categoryMeta = categoryLookup.get(payload.category.toLowerCase());

      await apiRequest('/transactions', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          description: payload.merchant,
          merchant: payload.merchant,
          amount: Math.abs(payload.amount),
          type: payload.type,
          date: payload.date,
          ...(categoryMeta ? { category_id: categoryMeta.id } : {}),
          notes: payload.notes,
          status: 'completed',
          source: 'Cash',
        }),
      });

      await fetchTransactions();
      toast.success('Cash transaction added successfully');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
        setError(err.message);
      } else {
        toast.error('Failed to add transaction');
      }
    }
  };

  const mergeImportUpdate = useCallback((rowIndex: number, update: ImportConfirmUpdate) => {
    setImportRowEdits((prev) => {
      const current = prev[rowIndex];

      if (!current) {
        return {
          ...prev,
          [rowIndex]: update,
        };
      }

      if (update.action === 'update') {
        return {
          ...prev,
          [rowIndex]: {
            row_index: rowIndex,
            action: 'update',
            patch: {
              ...(current.patch || {}),
              ...(update.patch || {}),
            },
          },
        };
      }

      return {
        ...prev,
        [rowIndex]: update,
      };
    });
  }, []);

  const handleImportPreviewReady = useCallback((payload: ImportPreviewResponse) => {
    setImportPreview(payload);
    setImportRowEdits({});
    setRecentImportAnomalies([]);
    setImportReviewOpen(true);
    setImportOpen(false);

    if (Array.isArray(payload.warnings) && payload.warnings.length > 0) {
      toast.message(`Preview generated with ${payload.warnings.length} warnings`);
    }
  }, []);

  const handleImportRowChange = useCallback(
    (
      rowIndex: number,
      patch: ImportRowPatch
    ) => {
      const normalizedPatch: ImportRowPatch = {
        ...patch,
        ...(patch.amount !== undefined && Number.isFinite(Number(patch.amount)) && Number(patch.amount) > 0
          ? { amount: Number(patch.amount) }
          : {}),
      };

      mergeImportUpdate(rowIndex, {
        row_index: rowIndex,
        action: 'update',
        patch: normalizedPatch,
      });

      setImportPreview((prev) => {
        if (!prev) return prev;

        const nextRows = prev.rows.map((row) => {
          if (row.row_index !== rowIndex) return row;

          return {
            ...row,
            review_payload: {
              ...row.review_payload,
              ...normalizedPatch,
            },
          };
        });

        return {
          ...prev,
          rows: nextRows,
        };
      });
    },
    [mergeImportUpdate]
  );

  const handleToggleImportExclude = useCallback(
    (rowIndex: number, excluded: boolean) => {
      mergeImportUpdate(rowIndex, {
        row_index: rowIndex,
        action: excluded ? 'remove' : 'restore',
      });

      setImportPreview((prev) => {
        if (!prev) return prev;

        const nextRows = prev.rows.map((row) =>
          row.row_index === rowIndex
            ? {
                ...row,
                is_excluded: excluded,
              }
            : row
        );

        return {
          ...prev,
          rows: nextRows,
        };
      });
    },
    [mergeImportUpdate]
  );

  const handleConfirmImport = useCallback(async () => {
    if (!importPreview) {
      toast.error('Import preview is missing');
      return;
    }

    const updates = Object.values(importRowEdits);

    setConfirmingImport(true);
    try {
      const result = await apiRequest<ImportConfirmResponse>('/transactions/import/confirm', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          session_id: importPreview.session_id,
          updates,
        }),
      });

      await fetchTransactions();

      const validationBlocks = Array.isArray(result.validation_blocks) ? result.validation_blocks : [];
      const validationBlockedCount =
        Number.isFinite(Number(result.validation_blocked))
          ? Number(result.validation_blocked)
          : validationBlocks.length;

      const persistenceErrors = Array.isArray(result.errors) ? result.errors : [];
      const createdRowIndexes = Array.isArray(result.created_row_indexes)
        ? result.created_row_indexes
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 0)
        : [];

      const importAnomalies = Array.isArray(result.anomalies) ? result.anomalies : [];
      setRecentImportAnomalies(importAnomalies);

      const savedSummary =
        result.failed_count > 0 || result.blocked_duplicates > 0 || validationBlockedCount > 0
          ? `Saved ${result.created_count}/${result.total_candidates} rows`
          : `Imported ${result.created_count} transactions`;
      toast.success(savedSummary);

      if (result.blocked_duplicates > 0) {
        toast.message(`${result.blocked_duplicates} rows were blocked as duplicates`);
      }

      if (validationBlockedCount > 0) {
        const blockedRows = validationBlocks
          .map((item) => (Number.isInteger(Number(item.row_index)) ? Number(item.row_index) + 1 : null))
          .filter((value): value is number => value !== null);

        toast.message(
          blockedRows.length > 0
            ? `${validationBlockedCount} rows need fixes (rows ${blockedRows.join(', ')})`
            : `${validationBlockedCount} rows need fixes before confirm can complete`
        );
      }

      if (persistenceErrors.length > 0) {
        toast.message(`${persistenceErrors.length} rows failed to save during confirm`);
      }

      const createdRowSet = new Set(createdRowIndexes);
      const validationMessagesByRow = new Map<number, string[]>();
      validationBlocks.forEach((block) => {
        const rowIndex = Number(block?.row_index);
        if (!Number.isInteger(rowIndex) || rowIndex < 0) return;

        const message = block?.reason ? `Confirm blocked: ${block.reason}` : 'Confirm blocked by validation';
        const existing = validationMessagesByRow.get(rowIndex) || [];
        existing.push(message);
        validationMessagesByRow.set(rowIndex, existing);
      });

      const persistenceMessagesByRow = new Map<number, string[]>();
      persistenceErrors.forEach((errorItem) => {
        const rowIndex = Number(errorItem?.row_index);
        if (!Number.isInteger(rowIndex) || rowIndex < 0) return;

        const message = errorItem?.error ? `Save failed: ${errorItem.error}` : 'Save failed during confirm';
        const existing = persistenceMessagesByRow.get(rowIndex) || [];
        existing.push(message);
        persistenceMessagesByRow.set(rowIndex, existing);
      });

      if (createdRowSet.size > 0 || validationMessagesByRow.size > 0 || persistenceMessagesByRow.size > 0) {
        setImportPreview((prev) => {
          if (!prev) return prev;

          const nextRows = prev.rows.map((row) => {
            const rowIndex = Number(row.row_index);
            const reviewWarnings = Array.isArray(row.review_payload?.warnings) ? row.review_payload.warnings : [];
            const validationWarnings = validationMessagesByRow.get(rowIndex) || [];
            const persistenceWarnings = persistenceMessagesByRow.get(rowIndex) || [];
            const warnings = [...new Set([...reviewWarnings, ...validationWarnings, ...persistenceWarnings])];

            const hasBlockingIssue = validationWarnings.length > 0 || persistenceWarnings.length > 0;

            return {
              ...row,
              is_excluded: createdRowSet.has(rowIndex) ? true : row.is_excluded,
              needs_review: hasBlockingIssue ? true : row.needs_review,
              review_payload: {
                ...row.review_payload,
                warnings,
              },
            };
          });

          return {
            ...prev,
            rows: nextRows,
          };
        });

        if (createdRowSet.size > 0) {
          setImportRowEdits((prev) => {
            const next = { ...prev };
            createdRowSet.forEach((rowIndex) => {
              delete next[rowIndex];
            });
            return next;
          });
        }
      }

      const hasBlockingIssues = validationBlockedCount > 0 || persistenceErrors.length > 0;

      if (importAnomalies.length > 0) {
        setImportRowEdits({});
        setImportPreview((prev) => (prev ? { ...prev, rows: [] } : prev));
      } else if (!hasBlockingIssues) {
        setImportReviewOpen(false);
        setImportPreview(null);
        setImportRowEdits({});
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
        setError(err.message);
      } else {
        toast.error('Failed to confirm import');
      }
    } finally {
      setConfirmingImport(false);
    }
  }, [importPreview, importRowEdits, fetchTransactions]);

  const handleDeleteTransaction = async (id: number) => {
    try {
      await apiRequest(`/transactions/${id}`, {
        method: 'DELETE',
        auth: true,
      });

      setTransactionsData((prev) => prev.filter((t) => t.id !== id));
      toast.success('Transaction deleted successfully');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
        setError(err.message);
      } else {
        toast.error('Failed to delete transaction');
      }
    }
  };

  const handleUpdateFromEditModal = (updatedTransaction: EditableTransaction) => {
    void handleUpdateTransaction({
      id: updatedTransaction.id,
      merchant: updatedTransaction.merchant,
      category: updatedTransaction.category,
      amount: updatedTransaction.amount,
      date: updatedTransaction.dateIso || updatedTransaction.date,
      status: updatedTransaction.status,
      source: updatedTransaction.source,
      notes: updatedTransaction.notes,
    });
  };

  const handleUpdateTransaction = async (payload: UpdateTransactionPayload) => {
    const categoryMeta = categoryLookup.get(payload.category.toLowerCase());
    const inferredType = categoryMeta?.type === 'income' || categoryMeta?.type === 'expense'
      ? categoryMeta.type
      : payload.amount >= 0
        ? 'income'
        : 'expense';

    const body = {
      description: payload.merchant,
      merchant: payload.merchant,
      amount: Math.abs(payload.amount),
      type: inferredType,
      date: payload.date,
      ...(categoryMeta ? { category_id: categoryMeta.id } : {}),
      status: payload.status,
      source: payload.source || 'Bank',
      notes: payload.notes,
    };

    try {
      await apiRequest(`/transactions/${payload.id}`, {
        method: 'PUT',
        auth: true,
        body: JSON.stringify(body),
      });

      await fetchTransactions();
      setSelectedTransaction(null);
      toast.success('Transaction updated successfully');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
        setError(err.message);
      } else {
        toast.error('Failed to update transaction');
      }
    }
  };

  const handleExport = () => {
    const escapeCSV = (value: string | number | undefined): string => {
      if (value === undefined || value === null) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = ['Date', 'Merchant', 'Category', 'Amount', 'Status', 'PaymentMethod', 'Notes'];
    const rows = filteredTransactions.map((t) => [
      escapeCSV(t.date),
      escapeCSV(t.merchant),
      escapeCSV(t.category),
      escapeCSV(t.amount),
      escapeCSV(t.status),
      escapeCSV(t.source || 'Bank'),
      escapeCSV(t.notes || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'finflow-transactions.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredTransactions.length} transactions`);
  };

  const categoryLookup = useMemo(() => {
    const map = new Map<string, { id: number; type: string }>();
    apiCategories.forEach((category) => {
      map.set(category.name.toLowerCase(), {
        id: category.category_id,
        type: category.type,
      });
    });
    return map;
  }, [apiCategories]);

  const categoryChips = useMemo(() => {
    const ordered: string[] = [];
    const seen = new Set<string>();

    const add = (name: string) => {
      const key = name.trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      ordered.push(name);
    };

    allCategories.forEach(add);
    apiCategories.forEach((category) => add(category.name));

    return ['All', ...ordered];
  }, [allCategories, apiCategories]);

  const filteredTransactions = useMemo(() => {
    return transactionsData.filter((transaction) => {
      const search = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !search ||
        transaction.merchant.toLowerCase().includes(search) ||
        transaction.category.toLowerCase().includes(search);

      const matchesCategory = selectedCategory === 'All' || transaction.category === selectedCategory;

      let matchesDate = true;
      if (appliedFilters.datePreset !== 'all') {
        const normalizedDate = transaction.dateIso;
        if (!normalizedDate) {
          matchesDate = false;
        } else {
          const [year, month, day] = normalizedDate.split('-').map(Number);
          if (![year, month, day].every(Number.isFinite)) {
            matchesDate = false;
          } else {
            const txnDate = new Date(year, month - 1, day);
            const daysAgoMap = { '7d': 7, '30d': 30, '3m': 90, '1y': 365 } as const;
            const daysAgo = daysAgoMap[appliedFilters.datePreset as keyof typeof daysAgoMap] || 365;
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - daysAgo);
            cutoff.setHours(0, 0, 0, 0);
            matchesDate = txnDate >= cutoff;
          }
        }
      }

      let matchesAmount = true;
      const absAmount = Math.abs(transaction.amount);

      if (appliedFilters.minAmount !== '') {
        const min = Number(appliedFilters.minAmount);
        if (!Number.isNaN(min)) matchesAmount = matchesAmount && absAmount >= min;
      }

      if (appliedFilters.maxAmount !== '') {
        const max = Number(appliedFilters.maxAmount);
        if (!Number.isNaN(max)) matchesAmount = matchesAmount && absAmount <= max;
      }

      return matchesSearch && matchesCategory && matchesDate && matchesAmount;
    });
  }, [transactionsData, searchQuery, selectedCategory, appliedFilters]);

  return (
    <div className="space-y-6 max-w-[1320px] mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold mb-1">All Transactions</h2>
          <p className="text-sm text-foreground/60">Track and manage your spending</p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button className="rounded-xl bg-primary hover:bg-primary/90" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button className="rounded-xl bg-primary hover:bg-primary/90" onClick={() => setManualOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Cash Transaction
          </Button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-4 rounded-3xl border-2">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
              <Input
                placeholder="Search by merchant or category..."
                className="pl-10 bg-accent/50 border-0 rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" className="rounded-xl" onClick={() => setFilterOpen(true)}>
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>

          <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
            {categoryChips.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-[#dcfce7] to-[#cffafe] text-primary'
                    : 'bg-accent text-foreground/70 hover:bg-accent/80'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="rounded-3xl border-2 overflow-hidden">
          {error && <p className="px-4 pt-4 text-sm text-red-600">{error}</p>}

          {loading ? (
            <p className="p-6 text-sm text-foreground/60">Loading transactions...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-accent/50 border-b">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-foreground/70">Date</th>
                    <th className="text-left p-4 text-sm font-medium text-foreground/70">Merchant</th>
                    <th className="text-left p-4 text-sm font-medium text-foreground/70">Category</th>
                    <th className="text-right p-4 text-sm font-medium text-foreground/70">Amount</th>
                    <th className="text-right p-4 text-sm font-medium text-foreground/70">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {filteredTransactions.map((transaction, index) => (
                      <motion.tr
                        key={transaction.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.02 }}
                        onClick={() => setSelectedTransaction(transaction)}
                        className="border-b hover:bg-accent/30 cursor-pointer transition-colors"
                      >
                        <td className="p-4 text-sm">{transaction.date}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
                              style={{ backgroundColor: transaction.color }}
                            >
                              {transaction.merchant.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium">{transaction.merchant}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-accent">
                              {transaction.category}
                            </span>
                            {transaction.source === 'Cash' && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#dcfce7] text-[#16a34a]">
                                💵 Cash
                              </span>
                            )}
                            {Array.isArray(transaction.anomalies) && transaction.anomalies.length > 0 && (
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  transaction.anomalies.some((item) => String(item.severity).toLowerCase() === 'high')
                                    ? 'bg-red-100 text-red-700'
                                    : transaction.anomalies.some((item) => String(item.severity).toLowerCase() === 'medium')
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                Anomaly {transaction.anomalies.length}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <span
                            className={`text-lg font-semibold ${
                              transaction.amount > 0 ? 'text-[#16a34a]' : 'text-foreground'
                            }`}
                          >
                            {transaction.amount > 0 ? '+' : '-'}{moneyFormatter(transaction.amount)}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#dcfce7] text-[#16a34a]">
                            {transaction.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredTransactions.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-accent mx-auto mb-4 flex items-center justify-center">
                <Search className="w-8 h-8 text-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
              <p className="text-sm text-foreground/60">Try adjusting your search or filters</p>
            </div>
          )}
        </Card>
      </motion.div>

      <Sheet open={!!selectedTransaction} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
        <SheetContent className="w-full sm:max-w-md flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden p-0 gap-0">
          <SheetHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
            <SheetTitle>Transaction Details</SheetTitle>
            <SheetDescription>View and edit transaction information</SheetDescription>
          </SheetHeader>

          {selectedTransaction && (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-6 scrollbar-hide">
                <div className="space-y-6">
                  <div className="flex items-center justify-center">
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-white text-3xl"
                      style={{ backgroundColor: selectedTransaction.color }}
                    >
                      {selectedTransaction.merchant.charAt(0).toUpperCase()}
                    </div>
                  </div>

                  <div className="text-center">
                    <div
                      className={`text-4xl font-bold mb-2 ${
                        selectedTransaction.amount > 0 ? 'text-[#16a34a]' : 'text-foreground'
                      }`}
                    >
                      {selectedTransaction.amount > 0 ? '+' : '-'}{moneyFormatter(selectedTransaction.amount)}
                    </div>
                    <div className="text-lg font-medium">{selectedTransaction.merchant}</div>
                    <div className="text-sm text-foreground/60 mt-1">{selectedTransaction.date}</div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-2xl">
                      <Tag className="w-5 h-5 text-foreground/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-foreground/60 mb-1">Category</div>
                        <div className="font-medium">{selectedTransaction.category}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-2xl">
                      <Calendar className="w-5 h-5 text-foreground/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-foreground/60 mb-1">Date</div>
                        <div className="font-medium">{selectedTransaction.date}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-2xl">
                      <DollarSign className="w-5 h-5 text-foreground/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-foreground/60 mb-1">Status</div>
                        <div className="font-medium capitalize">{selectedTransaction.status}</div>
                      </div>
                    </div>

                    {selectedTransaction.mlConfidence !== undefined && selectedTransaction.mlConfidence !== null && (
                      <div className="p-4 bg-accent/50 rounded-2xl">
                        <div className="text-xs text-foreground/60 mb-1">ML Confidence</div>
                        <div className="font-medium">{Math.round(selectedTransaction.mlConfidence * 100)}%</div>
                        {Array.isArray(selectedTransaction.topPredictions) &&
                          selectedTransaction.topPredictions.length > 0 && (
                            <div className="text-xs text-foreground/70 mt-2">
                              {selectedTransaction.topPredictions
                                .map((prediction) => `${prediction.category} (${Math.round(prediction.confidence * 100)}%)`)
                                .join(', ')}
                            </div>
                          )}
                      </div>
                    )}

                    {Array.isArray(selectedTransaction.anomalies) && selectedTransaction.anomalies.length > 0 && (
                      <div className="p-4 bg-accent/50 rounded-2xl space-y-2">
                        <div className="text-xs text-foreground/60">Anomaly Alerts</div>
                        {selectedTransaction.anomalies.slice(0, 5).map((anomaly) => (
                          <div key={anomaly.anomaly_id} className="rounded-xl border bg-white p-3">
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
                            <p className="mt-1 text-xs text-foreground/70">{anomaly.explanation}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0 px-6 py-4 border-t bg-background">
                <div className="space-y-3">
                  <Button
                    className="w-full rounded-xl"
                    onClick={() => {
                      setTransactionToEdit(selectedTransaction);
                      setSelectedTransaction(null);
                      requestAnimationFrame(() => setEditOpen(true));
                    }}
                  >
                    Edit Transaction
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl text-destructive hover:text-destructive"
                    onClick={() => {
                      setTransactionToDelete(selectedTransaction);
                      setSelectedTransaction(null);
                      requestAnimationFrame(() => setDeleteOpen(true));
                    }}
                  >
                    Delete Transaction
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden p-0 gap-0 z-50">
          <SheetHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
            <SheetTitle>Filter Transactions</SheetTitle>
            <SheetDescription>Refine your transaction view</SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-6 scrollbar-hide">
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-3 block">Date Range</label>
                <div className="space-y-2">
                  {[
                    { label: 'Last 7 days', value: '7d' as const },
                    { label: 'Last 30 days', value: '30d' as const },
                    { label: 'Last 3 months', value: '3m' as const },
                    { label: 'Last year', value: '1y' as const },
                    { label: 'All time', value: 'all' as const },
                  ].map((range) => (
                    <button
                      key={range.value}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                        draftFilters.datePreset === range.value
                          ? 'bg-gradient-to-r from-[#dcfce7] to-[#cffafe] text-primary font-medium border-2 border-[#86efac]'
                          : 'bg-accent/50 hover:bg-accent text-foreground/70'
                      }`}
                      onClick={() => setDraftFilters((prev) => ({ ...prev, datePreset: range.value }))}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-3 block">Amount Range</label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Min"
                    type="number"
                    step="0.01"
                    min="0"
                    className="rounded-xl bg-accent/50"
                    value={draftFilters.minAmount}
                    onChange={(e) => setDraftFilters((prev) => ({ ...prev, minAmount: e.target.value }))}
                  />
                  <Input
                    placeholder="Max"
                    type="number"
                    step="0.01"
                    min="0"
                    className="rounded-xl bg-accent/50"
                    value={draftFilters.maxAmount}
                    onChange={(e) => setDraftFilters((prev) => ({ ...prev, maxAmount: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 px-6 py-4 border-t bg-background">
            <div className="space-y-3">
              <Button
                className="w-full rounded-xl"
                onClick={() => {
                  const min = Number(draftFilters.minAmount);
                  const max = Number(draftFilters.maxAmount);

                  if (
                    draftFilters.minAmount !== '' &&
                    draftFilters.maxAmount !== '' &&
                    !Number.isNaN(min) &&
                    !Number.isNaN(max) &&
                    min > max
                  ) {
                    toast.error('Minimum amount cannot be greater than maximum');
                    return;
                  }

                  setAppliedFilters(draftFilters);
                  setFilterOpen(false);
                  toast.success('Filters applied successfully');
                }}
              >
                Apply Filters
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => {
                  const defaults = { datePreset: 'all' as DatePreset, minAmount: '', maxAmount: '' };
                  setDraftFilters(defaults);
                  setAppliedFilters(defaults);
                  toast.success('Filters reset');
                }}
              >
                Reset Filters
              </Button>
              <Button
                variant="ghost"
                className="w-full rounded-xl"
                onClick={() => {
                  setDraftFilters(appliedFilters);
                  setFilterOpen(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ManualCashEntryModal
        open={manualOpen}
        onOpenChange={setManualOpen}
        categoryOptions={apiCategories.map((category) => category.name)}
        onCreate={handleAddCashTransaction}
      />

      <ImportTransactionsModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onPreviewReady={handleImportPreviewReady}
      />

      <ImportReviewModal
        open={importReviewOpen}
        onOpenChange={(open) => {
          setImportReviewOpen(open);
          if (!open) {
            setImportPreview(null);
            setImportRowEdits({});
            setRecentImportAnomalies([]);
          }
        }}
        rows={importPreview?.rows || []}
        categoryOptions={apiCategories.map((category) => category.name)}
        onChangeRow={handleImportRowChange}
        onToggleExclude={handleToggleImportExclude}
        onConfirm={handleConfirmImport}
        confirming={confirmingImport}
        recentAnomalies={recentImportAnomalies}
      />

      <EditTransactionModal
        open={editOpen}
        onOpenChange={setEditOpen}
        transaction={transactionToEdit}
        categoryOptions={apiCategories.map((category) => category.name)}
        onUpdate={handleUpdateFromEditModal}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the transaction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (transactionToDelete) {
                  void handleDeleteTransaction(transactionToDelete.id);
                }
                setDeleteOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
