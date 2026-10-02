'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Mail, MapPin, Briefcase, Calendar, Receipt, Target, FileText, MessageSquare, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { adminGetUser } from '@/lib/admin-api';
import type { AdminUserDetail } from '@/lib/admin-types';

const roleColors = { admin: 'bg-violet-100 text-violet-700', user: 'bg-slate-100 text-slate-600' };
const statusColors = { active: 'bg-emerald-100 text-emerald-700', suspended: 'bg-red-100 text-red-700' };

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = Number(params.id);

  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || isNaN(userId)) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminGetUser(userId);
        setData(res);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load user');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (isNaN(userId)) return <p className="text-destructive">Invalid user ID</p>;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </Button>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      ) : !data ? null : (
        <>
          {/* User Profile Card */}
          <Card className="p-6">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shrink-0">
                {data.user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-semibold">{data.user.name}</h2>
                  <Badge className={roleColors[data.user.role as keyof typeof roleColors] || 'bg-slate-100'}>
                    {data.user.role}
                  </Badge>
                  <Badge className={statusColors[data.user.status as keyof typeof statusColors] || 'bg-slate-100'}>
                    {data.user.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-foreground/60 mt-2">
                  <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {data.user.email}</span>
                  {data.user.city && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {data.user.city}</span>}
                  {data.user.occupation && <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> {data.user.occupation}</span>}
                  <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Joined {new Date(data.user.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-foreground/40">Monthly Income</p>
                <p className="text-lg font-bold">PKR {Number(data.user.monthly_income).toLocaleString()}</p>
              </div>
            </div>
          </Card>

          {/* Transaction Summary */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground/60 mb-4 flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Transaction Summary
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-foreground/50">Transactions</p>
                <p className="text-2xl font-bold">{data.transaction_summary.count.toLocaleString()}</p>
              </div>
              <div className="text-emerald-600">
                <p className="text-xs text-foreground/50">Total Income</p>
                <p className="text-2xl font-bold">PKR {Number(data.transaction_summary.total_income).toLocaleString()}</p>
              </div>
              <div className="text-rose-600">
                <p className="text-xs text-foreground/50">Total Expenses</p>
                <p className="text-2xl font-bold">PKR {Number(data.transaction_summary.total_expenses).toLocaleString()}</p>
              </div>
              <div className={data.transaction_summary.savings_rate !== null && Number(data.transaction_summary.savings_rate) >= 0 ? 'text-violet-600' : 'text-amber-600'}>
                <p className="text-xs text-foreground/50">Savings Rate</p>
                <p className="text-2xl font-bold">{data.transaction_summary.savings_rate ?? 'N/A'}%</p>
              </div>
            </div>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'AI Queries', value: data.ai_query_count, icon: MessageSquare, color: 'violet' },
              { label: 'Support Tickets', value: data.support_count, icon: FileText, color: 'amber' },
              { label: 'Active Anomalies', value: data.active_anomaly_count, icon: AlertTriangle, color: 'rose' },
              { label: 'Import Sessions', value: data.import_sessions.length, icon: FileText, color: 'sky' },
            ].map((stat) => (
              <Card key={stat.label} className="p-4">
                <p className="text-xs text-foreground/50 mb-1">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </Card>
            ))}
          </div>

          {/* Budgets */}
          {data.budgets.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground/60 mb-4 flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Budgets
              </h3>
              <div className="space-y-3">
                {data.budgets.slice(0, 6).map((b) => {
                  const limit = Number(b.monthly_limit);
                  const spent = Number(b.spent || 0);
                  const pct = Math.min(100, (spent / limit) * 100);
                  return (
                    <div key={b.budget_id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{b.category_name}</span>
                        <span className={pct > 100 ? 'text-red-600' : pct > 80 ? 'text-amber-600' : 'text-emerald-600'}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={Math.min(100, pct)} className={`h-2 ${pct > 100 ? '[&>div]:bg-red-500' : pct > 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`} />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Recent Goals */}
          {data.goals.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground/60 mb-4 flex items-center gap-2">
                <Target className="h-4 w-4" /> Goals
              </h3>
              <div className="space-y-3">
                {data.goals.slice(0, 6).map((g) => {
                  const pct = Math.min(100, (Number(g.current_savings) / Number(g.target_amount)) * 100);
                  return (
                    <div key={g.goal_id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{g.title}</span>
                        <span>{pct.toFixed(0)}%</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                      <p className="text-[10px] text-foreground/40 mt-0.5">
                        PKR {Number(g.current_savings).toLocaleString()} / PKR {Number(g.target_amount).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}