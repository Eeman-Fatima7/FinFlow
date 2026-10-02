'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Eye, LifeBuoy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminListSupport } from '@/lib/admin-api';
import type { AdminSupportRow } from '@/lib/admin-types';

const statusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
};

export default function SupportPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<AdminSupportRow[]>([]);
  const [summary, setSummary] = useState({ open: 0, in_progress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const limit = 30;

  const fetchSupport = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page: pageNum, limit };
      if (statusFilter) params.status = statusFilter;
      const res = await adminListSupport(params);
      setRequests(res.requests);
      setSummary(res.summary);
      setTotal(res.total);
      setTotalPages(res.total_pages);
      setPage(pageNum);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void fetchSupport(1); }, [statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Support Requests</h2>
        <p className="text-sm text-foreground/50">{total.toLocaleString()} total tickets</p>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Open', value: summary.open, color: 'text-red-600' },
          { label: 'In Progress', value: summary.in_progress, color: 'text-amber-600' },
          { label: 'Resolved', value: summary.resolved, color: 'text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 px-4 py-2 border rounded-xl bg-card">
            <LifeBuoy className={`h-4 w-4 ${s.color}`} />
            <span className="text-sm font-medium">{s.value}</span>
            <span className="text-xs text-foreground/50">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-accent/50">
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Subject</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">User</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Status</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Date</th>
                <th className="px-4 py-3 text-right font-medium text-foreground/60">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(4)].map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>)}
                    <td className="px-4 py-3"><Skeleton className="h-8 w-20" /></td>
                  </tr>
                ))
              ) : requests.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-foreground/40">No support tickets found</td></tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.support_request_id} className="border-b hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm max-w-[280px] truncate block">{r.subject}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className="font-medium">{r.user_name}</p>
                      <p className="text-foreground/40">{r.user_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${statusColors[r.status] || 'bg-slate-100'} text-xs`}>
                        {r.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground/40 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/admin/support/${r.support_request_id}`)}
                        className="h-7 text-xs"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
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
              <Button variant="outline" size="sm" onClick={() => void fetchSupport(page - 1)} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center text-sm px-3">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => void fetchSupport(page + 1)} disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
