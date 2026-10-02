'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Receipt,
  FileText,
  AlertTriangle,
  LifeBuoy,
  Brain,
  TrendingUp,
  Shield,
  Activity,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { adminGetOverview } from '@/lib/admin-api';
import type { AdminOverview } from '@/lib/admin-types';

const mlStatusColor = (status: string) => {
  if (status === 'ok') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'degraded') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
};

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'violet',
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    violet: 'from-violet-50 to-purple-50 border-violet-200',
    emerald: 'from-emerald-50 to-green-50 border-emerald-200',
    amber: 'from-amber-50 to-yellow-50 border-amber-200',
    rose: 'from-rose-50 to-pink-50 border-rose-200',
    sky: 'from-sky-50 to-blue-50 border-sky-200',
    orange: 'from-orange-50 to-amber-50 border-orange-200',
  };
  return (
    <Card className={`p-5 border bg-gradient-to-br ${colorMap[color] || colorMap.violet}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-foreground/60 mb-1">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value ?? '—'}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/60 border`}>
          <Icon className="h-5 w-5 text-foreground/70" />
        </div>
      </div>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminGetOverview();
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (loading) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-6">Platform Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-16" />
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive mb-4">{error}</p>
        <button onClick={() => void load()} className="px-4 py-2 bg-primary text-white rounded-xl text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Platform Overview</h2>
          <p className="text-sm text-foreground/50">System health and activity summary</p>
        </div>
        <Badge className={`border ${mlStatusColor(data.ml_health.status)}`}>
          ML Service: {data.ml_health.status.toUpperCase()}
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={data.stats.total_users} icon={Users} color="violet" />
        <StatCard label="Active (30d)" value={data.stats.active_users_30d} icon={Activity} color="emerald" />
        <StatCard label="Total Transactions" value={data.stats.total_transactions.toLocaleString()} icon={Receipt} color="sky" />
        <StatCard label="Import Sessions" value={data.stats.total_import_sessions} icon={FileText} color="amber" />
        <StatCard label="Active Anomalies" value={data.stats.active_anomalies} icon={AlertTriangle} color="rose" />
        <StatCard label="Open Support" value={data.stats.open_support_tickets} icon={LifeBuoy} color="orange" />
        <StatCard label="ML Latency" value={data.ml_health.latency_ms ? `${data.ml_health.latency_ms}ms` : 'N/A'} icon={Brain} color="violet" />
        <StatCard label="ML Status" value={data.ml_health.status.toUpperCase()} icon={TrendingUp} color={data.ml_health.status === 'ok' ? 'emerald' : 'rose'} />
      </div>

      {/* Recent Activity Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground/80">Recent Users</h3>
            <Link href="/admin/users" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          {data.recent_users.length === 0 ? (
            <p className="text-sm text-foreground/40 py-8 text-center">No users yet</p>
          ) : (
            <div className="space-y-3">
              {data.recent_users.map((u) => (
                <div key={u.user_id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-foreground/40">{u.email}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs">{u.city || 'N/A'}</Badge>
                    <p className="text-[10px] text-foreground/30 mt-0.5">{new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Support */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground/80">Recent Support</h3>
            <Link href="/admin/support" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          {data.recent_support.length === 0 ? (
            <p className="text-sm text-foreground/40 py-8 text-center">No tickets</p>
          ) : (
            <div className="space-y-3">
              {data.recent_support.map((s) => (
                <div key={s.support_request_id} className="flex items-start justify-between py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.subject}</p>
                    <p className="text-xs text-foreground/40">{s.user_name}</p>
                  </div>
                  <Badge
                    className={`ml-3 shrink-0 text-xs ${s.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}
                  >
                    {s.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Transactions */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground/80">Recent Transactions</h3>
            <Link href="/admin/transactions" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          {data.recent_transactions.length === 0 ? (
            <p className="text-sm text-foreground/40 py-8 text-center">No transactions</p>
          ) : (
            <div className="space-y-3">
              {data.recent_transactions.slice(0, 6).map((t) => (
                <div key={t.transaction_id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.description || t.merchant || 'Transaction'}</p>
                    <p className="text-xs text-foreground/40">{t.user_name} · {t.type}</p>
                  </div>
                  <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {t.type === 'income' ? '+' : '−'}PKR {Number(t.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Import Sessions */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground/80">Recent Imports</h3>
            <Link href="/admin/import-sessions" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          {data.recent_import_sessions.length === 0 ? (
            <p className="text-sm text-foreground/40 py-8 text-center">No imports</p>
          ) : (
            <div className="space-y-3">
              {data.recent_import_sessions.map((s) => (
                <div key={s.import_session_id} className="flex items-start justify-between py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.file_name}</p>
                    <p className="text-xs text-foreground/40">{s.user_name} · {s.source_bank}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <Badge variant="outline" className="text-xs">{s.row_count || 0} rows</Badge>
                    <p className="text-[10px] text-foreground/30 mt-0.5">{new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}