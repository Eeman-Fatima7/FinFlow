'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';

// AuthUser type extended to include role
export type AuthUserWithRole = {
  user_id: number;
  name: string;
  email: string;
  role?: 'admin' | 'user';
  status?: 'active' | 'suspended';
  monthly_income: number;
  city: string | null;
  occupation: string | null;
  phone?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  preferred_theme?: string;
  preferred_compact_mode?: boolean;
  preferred_currency?: string;
  preferred_date_format?: string;
  preferred_language?: string;
  created_at: string;
};

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
        return;
      }
      // Check role from user object or default to 'user' if not set
      const role = (user as AuthUserWithRole).role;
      if (role !== 'admin') {
        router.replace('/dashboard');
      }
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Checking admin access...</p>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting
  if (!user || (user as AuthUserWithRole).role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Access Denied</h2>
          <p className="text-sm text-muted-foreground">Admin privileges required.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}