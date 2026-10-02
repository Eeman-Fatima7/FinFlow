'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { adminGetImportSession, adminGetImportSessionRows } from '@/lib/admin-api';
import type { AdminImportSessionDetail, AdminImportRow } from '@/lib/admin-types';

const stateColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-sky-100 text-sky-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

const sourceColors: Record<string, string> = {
  csv: 'bg-slate-100 text-slate-600',
  pdf: 'bg-red-100 text-red-600',
  image: 'bg-violet-100 text-violet-700',
};

export default function ImportSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = String(params.sessionId);

  const [session, setSession] = useState<AdminImportSessionDetail | null>(null);
  const [rows, setRows] = useState<AdminImportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [detailRow, setDetailRow] = useState<AdminImportRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminGetImportSession(sessionId);
        setSession(res);
        const rowsRes = await adminGetImportSessionRows(sessionId, { limit: 100 });
        setRows(rowsRes.rows);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const openRowDetail = (row: AdminImportRow) => {
    setDetailRow(row);
    setDetailOpen(true);
  };

  if (!sessionId) return <p className="text-destructive">Invalid session ID</p>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Import Sessions
      </Button>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      ) : !session ? null : (
        <>
          {/* Session Header */}
          <Card className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-semibold">{session.session.file_name}</h2>
                  <Badge className={`${stateColors[session.session.state] || 'bg-slate-100'}`}>
                    {session.session.state}
                  </Badge>
                  <Badge className={`${sourceColors[session.session.source_type] || 'bg-slate-100'} text-xs`}>
                    {session.session.source_type}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-foreground/60">
                  <span>{session.session.user_name}</span>
                  {session.session.source_bank && <span>Bank: {session.session.source_bank}</span>}
                  <span>{new Date(session.session.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Row metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t">
              <div>
                <p className="text-xs text-foreground/50">Total Rows</p>
                <p className="text-2xl font-bold">{session.session.total_rows ?? session.rows?.length ?? 0}</p>
              </div>
              <div className="text-emerald-600">
                <p className="text-xs text-foreground/50">Accepted</p>
                <p className="text-2xl font-bold">{session.session.accepted_rows ?? '—'}</p>
              </div>
              <div className="text-amber-600">
                <p className="text-xs text-foreground/50">Needs Review</p>
                <p className="text-2xl font-bold">{session.session.needs_review_rows ?? '—'}</p>
              </div>
              <div className="text-sky-600">
                <p className="text-xs text-foreground/50">Confidence</p>
                <p className="text-2xl font-bold">
                  {session.session.detection_confidence !== null
                    ? `${(Number(session.session.detection_confidence) * 100).toFixed(0)}%`
                    : '—'}
                </p>
              </div>
            </div>
          </Card>

          {/* Extracted Rows */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold text-foreground/60">Extracted Rows</h3>
              <span className="text-xs text-foreground/40">{rows.length} rows</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-accent/50">
                    <th className="px-4 py-3 text-left font-medium text-foreground/60">#</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground/60">Merchant</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground/60">Description</th>
                    <th className="px-4 py-3 text-right font-medium text-foreground/60">Amount (PKR)</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground/60">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground/60">Review</th>
                    <th className="px-4 py-3 text-left font-medium text-foreground/60">Dedupe</th>
                    <th className="px-4 py-3 text-right font-medium text-foreground/60">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-foreground/40">No rows extracted</td></tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.row_index} className="border-b hover:bg-accent/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-foreground/40">{r.row_index}</td>
                        <td className="px-4 py-3 text-xs font-medium max-w-[140px] truncate block">{r.merchant || '—'}</td>
                        <td className="px-4 py-3 text-xs text-foreground/60 max-w-[160px] truncate block">{r.description || '—'}</td>
                        <td className={`px-4 py-3 text-right text-xs font-semibold ${r.direction === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {r.amount !== null && r.amount !== undefined ? Number(r.amount).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">{r.type || '—'}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {r.needs_review ? (
                            <Badge className="bg-amber-100 text-amber-700 text-xs gap-1">
                              <AlertCircle className="h-3 w-3" /> Review
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs gap-1">
                              <CheckCircle className="h-3 w-3" /> OK
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.dedupe_status === 'duplicate' ? (
                            <Badge className="bg-red-100 text-red-700 text-xs gap-1">
                              <XCircle className="h-3 w-3" /> Duplicate
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-600 text-xs">Unique</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => openRowDetail(r)} className="h-7 text-xs">
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Detail
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Row Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={(v) => { if (!v) setDetailOpen(false); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Row #{detailRow?.row_index} Detail</SheetTitle>
          </SheetHeader>
          {detailRow && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-foreground/50">Merchant</p><p className="font-medium">{detailRow.merchant || '—'}</p></div>
                <div><p className="text-xs text-foreground/50">Direction</p><p>{detailRow.direction || '—'}</p></div>
                <div><p className="text-xs text-foreground/50">Type</p><p>{detailRow.type || '—'}</p></div>
                <div><p className="text-xs text-foreground/50">Amount</p><p className="font-bold">{detailRow.amount !== null ? Number(detailRow.amount).toLocaleString() : '—'}</p></div>
                <div><p className="text-xs text-foreground/50">Extraction Confidence</p><p>{detailRow.extraction_confidence !== null ? `${(Number(detailRow.extraction_confidence) * 100).toFixed(0)}%` : '—'}</p></div>
                <div><p className="text-xs text-foreground/50">Dedupe Status</p><Badge className={detailRow.dedupe_status === 'duplicate' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}>{detailRow.dedupe_status}</Badge></div>
              </div>
              {detailRow.duplicate_reason && (
                <div><p className="text-xs text-foreground/50 mb-1">Duplicate Reason</p><p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{detailRow.duplicate_reason}</p></div>
              )}
              {detailRow.description && (
                <div><p className="text-xs text-foreground/50 mb-1">Description</p><p className="text-sm">{detailRow.description}</p></div>
              )}
              {detailRow.top_predictions && detailRow.top_predictions.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-xs font-medium text-foreground/60 mb-2">Top Predictions</p>
                  <div className="space-y-1">
                    {detailRow.top_predictions.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span>{p.category}</span>
                        <Badge variant="outline" className="text-xs">{(p.confidence * 100).toFixed(0)}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
