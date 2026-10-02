'use client';

import { useEffect, useState } from 'react';
import { Server, Database, Brain, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { adminGetSystemHealth } from '@/lib/admin-api';
import type { AdminSystemHealthResponse } from '@/lib/admin-types';

function uptimeFormat(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

export default function SystemHealthPage() {
  const [data, setData] = useState<AdminSystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminGetSystemHealth();
        setData(res);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load system health');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">System Health</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">System Health</h2>
        <p className="text-sm text-foreground/50">Backend, database, and ML service status</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {/* Backend */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Server className="h-5 w-5 text-foreground/50" />
            <h3 className="text-sm font-semibold">Backend</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/50">Status</span>
              <Badge className={data.backend.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                {data.backend.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/50">Uptime</span>
              <span className="text-sm font-medium">{uptimeFormat(data.backend.uptime_s)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/50">DB Ping</span>
              <span className={`text-sm font-medium ${data.backend.db_ping_ms < 50 ? 'text-emerald-600' : data.backend.db_ping_ms < 200 ? 'text-amber-600' : 'text-red-600'}`}>
                {data.backend.db_ping_ms}ms
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/50">Version</span>
              <span className="text-xs text-foreground/40">v{data.backend.version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/50">Node</span>
              <span className="text-xs text-foreground/40">{data.node_version}</span>
            </div>
          </div>
        </Card>

        {/* Database */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-foreground/50" />
            <h3 className="text-sm font-semibold">Database</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/50">Status</span>
              <Badge className={data.db.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                {data.db.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/50">Connections</span>
              <span className="text-sm font-medium">{data.db.connection_count}</span>
            </div>
          </div>
        </Card>

        {/* ML Service */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-foreground/50" />
            <h3 className="text-sm font-semibold">ML Service</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/50">Status</span>
              <Badge className={data.ml.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : data.ml.status === 'degraded' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                {data.ml.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground/50">Latency</span>
              <span className="text-sm font-medium">
                {data.ml.latency_ms !== null ? `${data.ml.latency_ms}ms` : 'N/A'}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Env Sanity */}
      {data.env_sanity && Object.keys(data.env_sanity).length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground/60 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Environment Sanity Check
          </h3>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {Object.entries(data.env_sanity).map(([key, ok]) => (
              <div key={key} className="flex items-center gap-2">
                {ok
                  ? <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                  : <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                }
                <span className="text-sm">{key}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Server time */}
      <div className="text-xs text-foreground/40 text-center">
        Server time: {data.server_time}
      </div>
    </div>
  );
}
