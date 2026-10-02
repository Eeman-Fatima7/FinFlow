'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminListAnomalies, adminPatchAnomalyStatus } from '@/lib/admin-api';
import type { AdminAnomalyRow } from '@/lib/admin-types';
import { toast } from 'sonner';

const severityColors = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

const statusColors: Record<string, string> = {
  active: 'bg-red-100 text-red-700',
  read: 'bg-amber-100 text-amber-700',
  dismissed: 'bg-slate-100 text-slate-600',
  resolved: 'bg-emerald-100 text-emerald-700',
};

const typeColors: Record<string, string> = {
  spending_spike: 'bg-rose-100 text-rose-700',
  income_drop: 'bg-orange-100 text-orange-700',
  unusual_merchant: 'bg-violet-100 text-violet-700',
  budget_exceeded: 'bg-amber-100 text-amber-700',
  savings_goal_off_track: 'bg-sky-100 text-sky-700',
};

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<AdminAnomalyRow[]>([]);
  const [summary, setSummary] = useState({ active: 0, high: 0, medium: 0, low: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const limit = 30;

  const fetchAnomalies = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page: pageNum, limit };
      if (severityFilter) params.severity = severityFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await adminListAnomalies(params);
      setAnomalies(res.anomalies);
      setSummary(res.summary);
      setTotal(res.total);
      setTotalPages(res.total_pages);
      setPage(pageNum);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load anomalies');
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter]);

  useEffect(() => { void fetchAnomalies(1); }, [severityFilter, statusFilter]);

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await adminPatchAnomalyStatus(id, newStatus);
      toast.success('Status updated');
      await fetchAnomalies(page);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Anomaly Alerts</h2>
        <p className="text-sm text-foreground/50">{total.toLocaleString()} anomalies detected</p>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Active', value: summary.active, color: 'text-red-600' },
          { label: 'High', value: summary.high, color: 'text-red-600' },
          { label: 'Medium', value: summary.medium, color: 'text-amber-600' },
          { label: 'Low', value: summary.low, color: 'text-slate-600' },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 px-4 py-2 border rounded-xl bg-card">
            <AlertTriangle className={`h-4 w-4 ${s.color}`} />
            <span className="text-sm font-medium">{s.value}</span>
            <span className="text-xs text-foreground/50">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-accent/50">
                <th className="px-4 py-3 text-left font-medium text-foreground/60">User</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Title</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Type</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Severity</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Status</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Scope</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Date</th>
                <th className="px-4 py-3 text-right font-medium text-foreground/60">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>)}
                    <td className="px-4 py-3"><Skeleton className="h-8 w-20" /></td>
                  </tr>
                ))
              ) : anomalies.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-foreground/40">No anomalies found</td></tr>
              ) : (
                anomalies.map((a) => (
                  <tr key={a.anomaly_id} className="border-b hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3 text-xs">{a.user_name}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium max-w-[200px] truncate block">{a.title}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${typeColors[a.anomaly_type] || 'bg-slate-100'} text-xs`}>
                        {a.anomaly_type.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${severityColors[a.severity as keyof typeof severityColors] || 'bg-slate-100'} text-xs`}>
                        {a.severity}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${statusColors[a.status] || 'bg-slate-100'} text-xs`}>
                        {a.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground/50">{a.scope || '—'}</td>
                    <td className="px-4 py-3 text-xs text-foreground/40 whitespace-nowrap">
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <select
                        value={a.status}
                        onChange={(e) => void handleStatusChange(a.anomaly_id, e.target.value)}
                        className="text-xs border rounded-lg px-2 py-1 bg-background cursor-pointer"
                      >
                        <option value="active">active</option>
                        <option value="read">read</option>
                        <option value="dismissed">dismissed</option>
                        <option value="resolved">resolved</option>
                      </select>
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
              <Button variant="outline" size="sm" onClick={() => void fetchAnomalies(page - 1)} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center text-sm px-3">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => void fetchAnomalies(page + 1)} disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
