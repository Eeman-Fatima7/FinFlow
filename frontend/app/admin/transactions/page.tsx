'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminListTransactions, adminGetTransaction, adminPatchTransactionCategory, getCategories } from '@/lib/admin-api';
import type { AdminTransactionRow, AdminTransactionDetail, Category } from '@/lib/admin-types';
import { toast } from 'sonner';

const typeColors: Record<string, string> = { income: 'bg-emerald-100 text-emerald-700', expense: 'bg-rose-100 text-rose-700' };

function ConfBadge({ value }: { value: number | string | null | undefined }) {
  const v = Number(value);
  if (!v) return null;
  if (v >= 0.85) return <Badge className="bg-emerald-100 text-emerald-700 text-xs">High {v.toFixed(1)}</Badge>;
  if (v >= 0.60) return <Badge className="bg-amber-100 text-amber-700 text-xs">Med {v.toFixed(1)}</Badge>;
  return <Badge className="bg-red-100 text-red-700 text-xs">Low {v.toFixed(1)}</Badge>;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<AdminTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTxn, setDetailTxn] = useState<AdminTransactionDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [correctCatId, setCorrectCatId] = useState<number>(0);
  const [correcting, setCorrecting] = useState(false);

  const limit = 30;

  const fetchTxns = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page: pageNum, limit };
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await adminListTransactions(params);
      setTransactions(res.transactions);
      setTotal(res.total);
      setTotalPages(res.total_pages);
      setPage(pageNum);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter]);

  useEffect(() => { void fetchTxns(1); }, [search, typeFilter, statusFilter]);

  const openDetail = async (id: number) => {
    try {
      const cats = categories.length ? Promise.resolve(categories) : getCategories().then((c) => { setCategories(c); return c; });
      const [cats_data, detail] = await Promise.all([cats, adminGetTransaction(id)]);
      setCategories(cats_data as Category[]);
      setDetailTxn(detail.transaction);
      setCorrectCatId(detail.transaction.category_id || 0);
      setDetailOpen(true);
    } catch {
      toast.error('Failed to load transaction detail');
    }
  };

  const handleCorrect = async () => {
    if (!detailTxn || !correctCatId) return;
    setCorrecting(true);
    try {
      await adminPatchTransactionCategory(detailTxn.transaction_id, correctCatId);
      toast.success('Category corrected');
      setDetailOpen(false);
      await fetchTxns(page);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to correct category');
    } finally {
      setCorrecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Transactions</h2>
        <p className="text-sm text-foreground/50">{total.toLocaleString()} total</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <Input placeholder="Search merchant or description..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-accent/50 text-xs">
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Date</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">User</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/600">Merchant</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Type</th>
                <th className="px-4 py-3 text-right font-medium text-foreground/60">Amount (PKR)</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Category</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">ML</th>
                <th className="px-4 py-3 text-right font-medium text-foreground/60">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>)}
                  </tr>
                ))
              ) : transactions.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-foreground/40">No transactions found</td></tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.transaction_id} className="border-b hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-foreground/50 whitespace-nowrap">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs">{t.user_name}</td>
                    <td className="px-4 py-3 font-medium text-sm">{t.merchant || t.description}</td>
                    <td className="px-4 py-3"><Badge className={typeColors[t.type] || 'bg-slate-100'}>{t.type}</Badge></td>
                    <td className={`px-4 py-3 text-right font-semibold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === 'income' ? '+' : '−'}{Number(t.amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground/60">{t.category_name || <span className="text-amber-500">uncategorized</span>}</td>
                    <td className="px-4 py-3"><ConfBadge value={t.ml_confidence} /></td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => void openDetail(t.transaction_id)} className="h-7 text-xs">View</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-foreground/50">{(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void fetchTxns(page - 1)} disabled={page <= 1}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="flex items-center text-sm px-2">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => void fetchTxns(page + 1)} disabled={page >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={(v) => { if (!v) setDetailOpen(false); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Transaction Detail</SheetTitle>
          </SheetHeader>
          {detailTxn && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-foreground/50">User</p><p className="font-medium">{detailTxn.user_name}</p></div>
                <div><p className="text-xs text-foreground/50">Email</p><p className="text-foreground/60">{detailTxn.user_email}</p></div>
                <div><p className="text-xs text-foreground/50">Date</p><p>{detailTxn.date}</p></div>
                <div><p className="text-xs text-foreground/50">Type</p><Badge className={typeColors[detailTxn.type] || 'bg-slate-100'}>{detailTxn.type}</Badge></div>
                <div><p className="text-xs text-foreground/50">Amount</p><p className="font-bold text-lg">{Number(detailTxn.amount).toLocaleString()} PKR</p></div>
                <div><p className="text-xs text-foreground/50">Source</p><p>{detailTxn.source}</p></div>
                <div><p className="text-xs text-foreground/50">Description</p><p className="col-span-2">{detailTxn.description}</p></div>
                <div className="col-span-2"><p className="text-xs text-foreground/50">Merchant</p><p>{detailTxn.merchant || '—'}</p></div>
                {detailTxn.notes && <div className="col-span-2"><p className="text-xs text-foreground/50">Notes</p><p className="text-foreground/60">{detailTxn.notes}</p></div>}
                <div><p className="text-xs text-foreground/50">ML Confidence</p><ConfBadge value={detailTxn.ml_confidence} /></div>
                <div><p className="text-xs text-foreground/50">Status</p><Badge>{detailTxn.status}</Badge></div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Admin Category Correction</p>
                <select
                  value={correctCatId}
                  onChange={(e) => setCorrectCatId(Number(e.target.value))}
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-background"
                >
                  <option value={0}>Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>{c.name}</option>
                  ))}
                </select>
                <Button
                  onClick={() => void handleCorrect()}
                  disabled={correcting || !correctCatId}
                  className="w-full mt-3"
                >
                  {correcting ? 'Saving...' : 'Save Category Correction'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}