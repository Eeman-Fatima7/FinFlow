'use client';

import { useEffect, useState } from 'react';
import { Brain, Zap, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { adminGetMlHealth } from '@/lib/admin-api';
import type { AdminMlEndpointHealth } from '@/lib/admin-types';
import { toast } from 'sonner';

function EndpointCard({ name, health }: { name: string; health: AdminMlEndpointHealth }) {
  const statusIcon = health.status === 'ok'
    ? <CheckCircle className="h-5 w-5 text-emerald-600" />
    : health.status === 'error'
    ? <AlertTriangle className="h-5 w-5 text-amber-600" />
    : <XCircle className="h-5 w-5 text-red-600" />;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          health.status === 'ok' ? 'bg-emerald-100' : health.status === 'error' ? 'bg-amber-100' : 'bg-red-100'
        }`}>
          <Brain className={`h-5 w-5 ${
            health.status === 'ok' ? 'text-emerald-600' : health.status === 'error' ? 'text-amber-600' : 'text-red-600'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-sm">{name}</p>
            {statusIcon}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-foreground/50">
            <span>Status: <span className="font-medium">{health.status}</span></span>
            {health.latency_ms !== null && (
              <span>Latency: <span className="font-medium">{health.latency_ms}ms</span></span>
            )}
            {health.status_code && (
              <span>Code: <span className="font-medium">{health.status_code}</span></span>
            )}
          </div>
          {health.error && (
            <p className="text-xs text-red-500 mt-1 truncate block">{health.error}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function MlHealthPage() {
  const [data, setData] = useState<{ status: string; endpoints: Record<string, AdminMlEndpointHealth> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminGetMlHealth();
        setData(res);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load ML health');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">ML Health</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-white rounded-xl text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const endpointEntries = Object.entries(data.endpoints);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">ML Health</h2>
          <p className="text-sm text-foreground/50">Service endpoints status and latency</p>
        </div>
        <Badge className={`${
          data.status === 'ok' ? 'bg-emerald-100 text-emerald-700' :
          data.status === 'degraded' ? 'bg-amber-100 text-amber-700' :
          'bg-red-100 text-red-700'
        }`}>
          {data.status.toUpperCase()}
        </Badge>
      </div>

      {/* Aggregate status */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'OK', count: endpointEntries.filter(([, h]) => h.status === 'ok').length, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { label: 'Error', count: endpointEntries.filter(([, h]) => h.status === 'error').length, color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { label: 'Offline', count: endpointEntries.filter(([, h]) => h.status === 'offline').length, color: 'text-red-600 bg-red-50 border-red-200' },
        ].map((s) => (
          <Card key={s.label} className={`p-4 border ${s.color}`}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-xs font-medium">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Endpoint cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {endpointEntries.map(([name, health]) => (
          <EndpointCard key={name} name={name} health={health} />
        ))}
      </div>

      {endpointEntries.length === 0 && (
        <div className="text-center py-16 text-foreground/40">
          No ML endpoints configured
        </div>
      )}
    </div>
  );
}
