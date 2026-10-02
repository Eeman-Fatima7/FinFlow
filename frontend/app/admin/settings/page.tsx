'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-foreground/50">Admin profile and system settings</p>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shrink-0">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{user?.name}</h3>
              <Badge className="bg-violet-100 text-violet-700">Admin</Badge>
            </div>
            <p className="text-sm text-foreground/50">{user?.email}</p>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-foreground/50">Role</span>
            <span className="font-medium capitalize">{user?.role || 'admin'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/50">Status</span>
            <Badge className="bg-emerald-100 text-emerald-700">{user?.status || 'active'}</Badge>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground/60 mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4" /> Platform Settings
        </h3>
        <p className="text-sm text-foreground/40">
          Additional platform configuration options will appear here in a future update.
        </p>
      </Card>
    </div>
  );
}
