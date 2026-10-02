'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, isAuthenticated, onboarding } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (
      !loading &&
      isAuthenticated &&
      onboarding?.onboarding_required &&
      pathname !== '/onboarding/budget-plan'
    ) {
      router.replace('/onboarding/budget-plan');
    }
  }, [loading, isAuthenticated, onboarding, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-zinc-500">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
