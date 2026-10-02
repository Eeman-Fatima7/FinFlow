'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminListUsers, adminPatchUser } from '@/lib/admin-api';
import type { AdminUserRow } from '@/lib/admin-types';
import { toast } from 'sonner';

const roleColors = { admin: 'bg-violet-100 text-violet-700', user: 'bg-slate-100 text-slate-600' };
const statusColors = { active: 'bg-emerald-100 text-emerald-700', suspended: 'bg-red-100 text-red-700' };

function UserRowSkeleton() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
      ))}
      <td className="px-4 py-3"><Skeleton className="h-8 w-20" /></td>
    </tr>
  );
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [changingId, setChangingId] = useState<number | null>(null);

  const limit = 20;

  const fetchUsers = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page: pageNum, limit };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await adminListUsers(params);
      setUsers(res.users);
      setTotal(res.total);
      setTotalPages(res.total_pages);
      setPage(pageNum);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => { void fetchUsers(1); }, [search, roleFilter, statusFilter]);

  const handleRoleChange = async (userId: number, newRole: string) => {
    setChangingId(userId);
    try {
      await adminPatchUser(userId, { role: newRole });
      await fetchUsers(page);
      toast.success(`Role updated for user ${userId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setChangingId(null);
    }
  };

  const handleStatusChange = async (userId: number, newStatus: string) => {
    setChangingId(userId);
    try {
      await adminPatchUser(userId, { status: newStatus });
      await fetchUsers(page);
      toast.success(`Status updated for user ${userId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setChangingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Users</h2>
        <p className="text-sm text-foreground/50">{total.toLocaleString()} total users</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-accent/50">
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Name</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Email</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">City</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Role</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Status</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Transactions</th>
                <th className="px-4 py-3 text-left font-medium text-foreground/60">Joined</th>
                <th className="px-4 py-3 text-right font-medium text-foreground/60">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => <UserRowSkeleton key={i} />)
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-foreground/40">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.user_id} className="border-b hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-foreground/60">{u.email}</td>
                    <td className="px-4 py-3 text-foreground/60">{u.city || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={changingId === u.user_id}
                        onChange={(e) => void handleRoleChange(u.user_id, e.target.value)}
                        className="text-xs border rounded-lg px-2 py-1 bg-background cursor-pointer"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${statusColors[u.status as keyof typeof statusColors] || 'bg-slate-100'}`}>
                        {u.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground/60">{u.transaction_count}</td>
                    <td className="px-4 py-3 text-foreground/40 text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/admin/users/${u.user_id}`)}
                        className="h-8 text-xs"
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-xs text-foreground/50">
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchUsers(page - 1)}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex items-center text-sm px-3">{page} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchUsers(page + 1)}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}