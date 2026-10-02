'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { adminListAiLogs } from '@/lib/admin-api';
import type { AdminAiLogRow } from '@/lib/admin-types';

export default function AiLogsPage() {
  const [logs, setLogs] = useState<AdminAiLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLog, setDetailLog] = useState<AdminAiLogRow | null>(null);

  const limit = 30;

  const fetchLogs = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminListAiLogs({ page: pageNum, limit });
      setLogs(res.logs);
      setTotal(res.total);
      setTotalPages(res.total_pages);
      setPage(pageNum);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load AI logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchLogs(1); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">AI Chat Logs</h2>
        <p className="text-sm text-foreground/50">{total.toLocaleString()} interactions</p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-accent/50">
                <th className="px-4 py-3 text-left font-medium text-foreground/60">User</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Channel</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Query Preview</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Response Preview</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Date</th>
                <th className="px-4 py-3 text-right font-medium text-foreground/60">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>)}
                    <td className="px-4 py-3"><Skeleton className="h-8 w-20" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-foreground/40">No AI logs found</td></tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.log_id} className="border-b hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3 text-xs">
                      <p className="font-medium">{l.user_name}</p>
                      <p className="text-foreground/40">{l.user_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{l.channel}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate block text-foreground/70">
                      {l.input_text}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[200px] truncate block text-foreground/50">
                      {l.response_text.substring(0, 80)}...
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground/40 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setDetailLog(l); setDetailOpen(true); }}
                        className="h-7 text-xs"
                      >
                        View
                      </Button>
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
              <Button variant="outline" size="sm" onClick={() => void fetchLogs(page - 1)} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center text-sm px-3">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => void fetchLogs(page + 1)} disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={(v) => { if (!v) setDetailOpen(false); }}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>AI Interaction Detail</SheetTitle>
          </SheetHeader>
          {detailLog && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-foreground/50">User</p><p className="font-medium">{detailLog.user_name}</p></div>
                <div><p className="text-xs text-foreground/50">Email</p><p className="text-foreground/60">{detailLog.user_email}</p></div>
                <div><p className="text-xs text-foreground/50">Channel</p><Badge variant="outline">{detailLog.channel}</Badge></div>
                <div><p className="text-xs text-foreground/50">Date</p><p className="text-xs">{detailLog.created_at}</p></div>
              </div>
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-foreground/60 mb-2">Query</p>
                <div className="bg-accent/30 rounded-xl p-3 text-sm">
                  <p>{detailLog.input_text}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground/60 mb-2">Response</p>
                <div className="bg-accent/30 rounded-xl p-3 text-sm max-h-64 overflow-y-auto">
                  <p className="text-foreground/80 whitespace-pre-wrap">{detailLog.response_text}</p>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
