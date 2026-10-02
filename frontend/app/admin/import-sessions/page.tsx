'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight, FileText, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminListImportSessions } from '@/lib/admin-api';
import type { AdminImportSessionRow } from '@/lib/admin-types';

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

function SessionRowSkeleton() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
      ))}
      <td className="px-4 py-3"><Skeleton className="h-8 w-20" /></td>
    </tr>
  );
}

export default function ImportSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AdminImportSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  const limit = 20;

  const fetchSessions = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page: pageNum, limit };
      if (search) params.search = search;
      if (stateFilter) params.state = stateFilter;
      if (sourceFilter) params.source_type = sourceFilter;
      const res = await adminListImportSessions(params);
      setSessions(res.sessions);
      setTotal(res.total);
      setTotalPages(res.total_pages);
      setPage(pageNum);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load import sessions');
    } finally {
      setLoading(false);
    }
  }, [search, stateFilter, sourceFilter]);

  useEffect(() => { void fetchSessions(1); }, [search, stateFilter, sourceFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Import Sessions</h2>
        <p className="text-sm text-foreground/50">{total.toLocaleString()} total sessions</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <Input placeholder="Search by user or file..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={stateFilter} onValueChange={(v) => setStateFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="State" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="csv">CSV</SelectItem>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="image">Image</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-accent/50">
                <th className="px-4 py-3 text-left font-medium text-foreground/60">File</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">User</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Bank</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Source</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">State</th>
                <th className="px-4 py-3 text-right font-medium text-foreground/60">Rows</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Date</th>
                <th className="px-4 py-3 text-right font-medium text-foreground/60">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => <SessionRowSkeleton key={i} />)
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-foreground/40">No import sessions found</td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.import_session_id} className="border-b hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-foreground/30 shrink-0" />
                        <span className="font-medium text-xs max-w-[160px] truncate block">{s.file_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className="font-medium">{s.user_name}</p>
                      <p className="text-foreground/40">{s.user_email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground/60">{s.source_bank || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${sourceColors[s.source_type as keyof typeof sourceColors] || 'bg-slate-100'} text-xs`}>
                        {s.source_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${stateColors[s.state as keyof typeof stateColors] || 'bg-slate-100'} text-xs`}>
                        {s.state}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-foreground/60">
                      {s.total_rows ?? s.row_count ?? 0}
                      {s.needs_review_rows ? (
                        <span className="text-amber-500 ml-1">({s.needs_review_rows} ⚠)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground/40 whitespace-nowrap">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/admin/import-sessions/${s.import_session_id}`)}
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
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void fetchSessions(page - 1)} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center text-sm px-3">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => void fetchSessions(page + 1)} disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
