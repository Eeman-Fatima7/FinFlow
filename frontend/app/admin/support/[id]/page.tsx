'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, LifeBuoy, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminGetSupport, adminPatchSupport } from '@/lib/admin-api';
import type { AdminSupportDetail } from '@/lib/admin-types';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
};

export default function SupportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = Number(params.id);

  const [data, setData] = useState<AdminSupportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!ticketId || isNaN(ticketId)) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminGetSupport(ticketId);
        setData(res.request);
        setNewStatus(res.request.status);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load ticket');
      } finally {
        setLoading(false);
      }
    })();
  }, [ticketId]);

  if (isNaN(ticketId)) return <p className="text-destructive">Invalid ticket ID</p>;

  const handleUpdate = async () => {
    if (!newStatus) return;
    setUpdating(true);
    try {
      await adminPatchSupport(ticketId, { status: newStatus, admin_note: adminNote || undefined });
      toast.success('Ticket updated');
      setAdminNote('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Support
      </Button>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      ) : !data ? null : (
        <div className="space-y-6">
          {/* Ticket Header */}
          <Card className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <LifeBuoy className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-semibold">{data.subject}</h2>
                  <Badge className={`${statusColors[data.status] || 'bg-slate-100'}`}>
                    {data.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-foreground/60">
                  <span>{data.user_name}</span>
                  <span>{data.user_email}</span>
                  <span>{new Date(data.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Message */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground/60 mb-3">User Message</h3>
            <div className="bg-accent/30 rounded-xl p-4 text-sm whitespace-pre-wrap">
              {data.message}
            </div>
          </Card>

          {/* Admin actions */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground/60 mb-4">Update Ticket</h3>
            <div className="space-y-4">
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Change status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Add an admin note (internal)..."
                className="w-full border rounded-xl px-3 py-2 text-sm bg-background min-h-[80px]"
              />
              <Button onClick={() => void handleUpdate()} disabled={updating || !newStatus}>
                <Send className="h-4 w-4 mr-1" />
                {updating ? 'Saving...' : 'Update Ticket'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
