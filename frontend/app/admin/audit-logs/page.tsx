'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { adminListAuditLogs } from '@/lib/admin-api';
import type { AdminAuditLogRow } from '@/lib/admin-types';

const actionColors: Record<string, string> = {
  patch: 'bg-sky-100 text-sky-700',
  post: 'bg-emerald-100 text-emerald-700',
  delete: 'bg-red-100 text-red-700',
  get: 'bg-slate-100 text-slate-600',
  denied: 'bg-red-100 text-red-700',
};

function actionColor(action: string): string {
  if (action.endsWith('_denied') || action.includes('denied')) return 'bg-red-100 text-red-700';
  if (action.startsWith('patch')) return 'bg-sky-100 text-sky-700';
  if (action.startsWith('post') || action.startsWith('approve') || action.startsWith('correct')) return 'bg-emerald-100 text-emerald-700';
  if (action.startsWith('delete')) return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-600';
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AdminAuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [actorSearch, setActorSearch] = useState('');

  const limit = 50;

  const fetchLogs = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page: pageNum, limit };
      if (actionFilter) params.action = actionFilter;
      if (actorSearch) params.actor_email = actorSearch;
      const res = await adminListAuditLogs(params);
      setLogs(res.logs);
      setTotal(res.total);
      setTotalPages(res.total_pages);
      setPage(pageNum);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, actorSearch]);

  useEffect(() => { void fetchLogs(1); }, [actionFilter, actorSearch]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Audit Logs</h2>
        <p className="text-sm text-foreground/50">{total.toLocaleString()} entries</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <Input
            placeholder="Search actor email..."
            value={actorSearch}
            onChange={(e) => setActorSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={actionFilter} onValueChange={(v) => setActionFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="patch_user_role">Role change</SelectItem>
            <SelectItem value="patch_user_status">Status change</SelectItem>
            <SelectItem value="patch_transaction_category">Category correction</SelectItem>
            <SelectItem value="patch_support_status">Support update</SelectItem>
            <SelectItem value="patch_anomaly">Anomaly update</SelectItem>
            <SelectItem value="approve_categorization">Approve categorization</SelectItem>
            <SelectItem value="correct_categorization">Correct categorization</SelectItem>
            <SelectItem value="denied">Denials</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-accent/50">
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Timestamp</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Actor</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Action</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Resource</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">IP Address</th>
                <th className="px-4 py-3 text-right font-medium text-foreground/60">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>)}
                    <td className="px-4 py-3"><Skeleton className="h-6 w-12" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-foreground/40">No audit log entries</td></tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.audit_log_id} className="border-b hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-foreground/40 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className="font-medium truncate max-w-[160px] block">{l.actor_email || 'System'}</p>
                      <p className="text-foreground/30 text-[10px]">ID: {l.actor_user_id || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${actionColor(l.action)} text-xs`}>
                        {l.action.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground/50">
                      <span className="font-medium">{l.resource_type}</span>
                      {l.resource_id && <span className="text-foreground/30"> #{l.resource_id}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground/40 font-mono">
                      {l.ip_address || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {l.response_status ? (
                        <Badge
                          className={`text-xs ${l.response_status < 400 ? 'bg-emerald-100 text-emerald-700' : l.response_status < 500 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}
                        >
                          {l.response_status}
                        </Badge>
                      ) : <span className="text-xs text-foreground/30">—</span>}
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
    </div>
  );
}
