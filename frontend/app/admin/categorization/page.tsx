'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  adminListCategorizationReview,
  adminApproveCategorization,
  adminCorrectCategorization,
  getCategories,
} from '@/lib/admin-api';
import type { AdminFeedbackEvent, Category } from '@/lib/admin-types';
import { toast } from 'sonner';

function ConfBadge({ value }: { value: number | string | null | undefined }) {
  const v = Number(value);
  if (!v) return <Badge variant="outline" className="text-xs">N/A</Badge>;
  if (v >= 0.85) return <Badge className="bg-emerald-100 text-emerald-700 text-xs">High {v.toFixed(2)}</Badge>;
  if (v >= 0.60) return <Badge className="bg-amber-100 text-amber-700 text-xs">Med {v.toFixed(2)}</Badge>;
  return <Badge className="bg-red-100 text-red-700 text-xs">Low {v.toFixed(2)}</Badge>;
}

const kindColors: Record<string, string> = {
  user_feedback: 'bg-sky-100 text-sky-700',
  admin_correction: 'bg-violet-100 text-violet-700',
};

export default function CategorizationPage() {
  const [events, setEvents] = useState<AdminFeedbackEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [daysFilter, setDaysFilter] = useState('30');
  const [categories, setCategories] = useState<Category[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<AdminFeedbackEvent | null>(null);
  const [correctCatId, setCorrectCatId] = useState<number>(0);
  const [actingId, setActingId] = useState<number | null>(null);

  const limit = 30;

  const fetchEvents = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListCategorizationReview({
        page: pageNum,
        limit,
        days: Number(daysFilter),
      });
      setEvents(res.events);
      setTotal(res.total);
      setTotalPages(res.total_pages);
      setPage(pageNum);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [daysFilter]);

  useEffect(() => { void fetchEvents(1); }, [daysFilter]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  const openDetail = (event: AdminFeedbackEvent) => {
    setDetailEvent(event);
    setCorrectCatId(0);
    setDetailOpen(true);
  };

  const handleApprove = async (eventId: number) => {
    setActingId(eventId);
    try {
      await adminApproveCategorization(eventId);
      toast.success('Prediction approved');
      await fetchEvents(page);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActingId(null);
    }
  };

  const handleCorrect = async () => {
    if (!detailEvent || !correctCatId) return;
    setActingId(detailEvent.feedback_event_id);
    try {
      await adminCorrectCategorization(detailEvent.feedback_event_id, correctCatId);
      toast.success('Category corrected');
      setDetailOpen(false);
      await fetchEvents(page);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to correct');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Categorization Review</h2>
        <p className="text-sm text-foreground/50">{total.toLocaleString()} feedback events</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={daysFilter} onValueChange={(v) => setDaysFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Time window" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-accent/50">
                <th className="px-4 py-3 text-left font-medium text-foreground/60">User</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Merchant</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Predicted</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Final</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Confidence</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Kind</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Date</th>
                <th className="px-4 py-3 text-right font-medium text-foreground/60">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>)}
                    <td className="px-4 py-3"><Skeleton className="h-8 w-24" /></td>
                  </tr>
                ))
              ) : events.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-foreground/40">No feedback events found</td></tr>
              ) : (
                events.map((e) => (
                  <tr key={e.feedback_event_id} className="border-b hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3 text-xs">{e.user_name}</td>
                    <td className="px-4 py-3 text-xs font-medium max-w-[160px] truncate block">{e.merchant || '—'}</td>
                    <td className="px-4 py-3 text-xs text-sky-600">{e.predicted_category_name || <span className="text-foreground/30">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-emerald-600">{e.final_category_name || <span className="text-amber-500">uncategorized</span>}</td>
                    <td className="px-4 py-3"><ConfBadge value={e.predicted_confidence} /></td>
                    <td className="px-4 py-3">
                      <Badge className={`${kindColors[e.feedback_kind] || 'bg-slate-100'} text-xs`}>{e.feedback_kind}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground/40 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetail(e)}
                          className="h-7 text-xs"
                        >
                          <AlertCircle className="h-3.5 w-3.5 mr-1" />
                          Review
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-foreground/50">
              {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void fetchEvents(page - 1)} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center text-sm px-3">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => void fetchEvents(page + 1)} disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Review Sheet */}
      <Sheet open={detailOpen} onOpenChange={(v) => { if (!v) setDetailOpen(false); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Feedback Event Detail</SheetTitle>
          </SheetHeader>
          {detailEvent && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-foreground/50">User</p><p className="font-medium">{detailEvent.user_name}</p></div>
                <div><p className="text-xs text-foreground/50">Kind</p><Badge className={`${kindColors[detailEvent.feedback_kind] || 'bg-slate-100'}`}>{detailEvent.feedback_kind}</Badge></div>
                <div><p className="text-xs text-foreground/50">Merchant</p><p>{detailEvent.merchant || '—'}</p></div>
                <div><p className="text-xs text-foreground/50">Amount</p><p>{detailEvent.amount ? Number(detailEvent.amount).toLocaleString() : '—'}</p></div>
                <div><p className="text-xs text-foreground/50">Direction</p><p>{detailEvent.direction || '—'}</p></div>
                <div><p className="text-xs text-foreground/50">Model Version</p><p className="text-xs">{detailEvent.model_version || '—'}</p></div>
                <div className="col-span-2"><p className="text-xs text-foreground/50">ML Confidence</p><ConfBadge value={detailEvent.predicted_confidence} /></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-xl p-4 text-center">
                  <p className="text-xs text-foreground/50 mb-1">Predicted</p>
                  <p className="font-semibold text-sky-600">{detailEvent.predicted_category_name || '—'}</p>
                </div>
                <div className="border rounded-xl p-4 text-center">
                  <p className="text-xs text-foreground/50 mb-1">Final</p>
                  <p className="font-semibold text-emerald-600">{detailEvent.final_category_name || <span className="text-amber-500">uncategorized</span>}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => void handleApprove(detailEvent.feedback_event_id)}
                  disabled={actingId === detailEvent.feedback_event_id}
                  className="flex-1"
                  variant="default"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve Prediction
                </Button>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Or Correct Category</p>
                <select
                  value={correctCatId}
                  onChange={(e) => setCorrectCatId(Number(e.target.value))}
                  className="w-full border rounded-xl px-3 py-2 text-sm bg-background"
                >
                  <option value={0}>Select a category...</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>{c.name}</option>
                  ))}
                </select>
                <Button
                  onClick={() => void handleCorrect()}
                  disabled={actingId === detailEvent.feedback_event_id || !correctCatId}
                  className="w-full mt-3"
                  variant="outline"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  {actingId === detailEvent.feedback_event_id ? 'Saving...' : 'Save Correction'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
