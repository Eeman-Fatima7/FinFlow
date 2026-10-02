'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Users,
  Receipt,
  FileText,
  Tags,
  Target,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  Mic,
  LifeBuoy,
  Brain,
  Server,
  Settings,
  ClipboardList,
  LogOut,
  Shield,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { toast } from 'sonner';

const adminNav = [
  { name: 'Overview', href: '/admin/overview', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Transactions', href: '/admin/transactions', icon: Receipt },
  { name: 'Import Sessions', href: '/admin/import-sessions', icon: FileText },
  { name: 'Categorization Review', href: '/admin/categorization', icon: Tags },
  { name: 'Budgets & Goals', href: '/admin/budgets', icon: Target },
  { name: 'Forecasting', href: '/admin/forecasting', icon: TrendingUp },
  { name: 'Anomaly Alerts', href: '/admin/anomalies', icon: AlertTriangle },
  { name: 'AI Chat Logs', href: '/admin/ai-logs', icon: MessageSquare },
  { name: 'Voice Logs', href: '/admin/voice-logs', icon: Mic },
  { name: 'Support Requests', href: '/admin/support', icon: LifeBuoy },
  { name: 'ML Monitoring', href: '/admin/ml-health', icon: Brain },
  { name: 'System Health', href: '/admin/system-health', icon: Server },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: ClipboardList },
];

const isRouteActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + '/');

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const currentPage = useMemo(
    () => adminNav.find((item) => isRouteActive(pathname, item.href))?.name || 'Admin Dashboard',
    [pathname]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobileViewport(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const handleLogout = () => {
    logout();
    localStorage.removeItem('finflow.user');
    localStorage.removeItem('finflow.session');
    toast.success('Signed out successfully');
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col border-r border-border bg-card">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto px-6 py-6">
          {/* Logo */}
          <Link href="/admin/overview" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-foreground">FinFlow</span>
            <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full border border-violet-200">
              ADMIN
            </span>
          </Link>

          <nav className="flex flex-1 flex-col gap-1">
            {adminNav.map((item) => {
              const active = isRouteActive(pathname, item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all text-sm ${
                    active
                      ? 'bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 font-semibold border border-violet-200'
                      : 'text-foreground/50 hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Admin identity footer */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-violet-50 border border-violet-100">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center overflow-hidden shrink-0 text-sm font-bold text-white">
                {(user?.name || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-violet-800 truncate">{user?.name || 'Admin'}</div>
                <div className="text-[10px] text-violet-500 truncate">{user?.email || ''}</div>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-1">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-foreground/50 hover:bg-accent hover:text-foreground transition-all"
              >
                <Sparkles className="h-3.5 w-3.5" />
                User Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-foreground/50 hover:bg-destructive/10 hover:text-destructive transition-all"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
        <nav className="flex justify-around items-center h-14 px-1">
          {adminNav.slice(0, 5).map((item) => {
            const active = isRouteActive(pathname, item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 ${
                  active ? 'text-violet-600' : 'text-foreground/40'
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="text-[9px] font-medium">{item.name.split(' ')[0]}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-foreground/40"
          >
            <Menu className="h-4 w-4" />
            <span className="text-[9px] font-medium">More</span>
          </button>
        </nav>
      </div>

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-card/80 backdrop-blur-sm px-4 lg:px-8">
          <button className="lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex items-center gap-2 flex-1">
            <Shield className="h-5 w-5 text-violet-600 hidden lg:block" />
            <h1 className="text-base font-semibold">{currentPage}</h1>
          </div>

          {/* Admin badge */}
          <div className="hidden md:flex items-center gap-2 text-xs text-violet-600 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-full">
            <Shield className="h-3.5 w-3.5" />
            <span className="font-semibold">Admin Panel</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-foreground/50 hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-accent transition-all"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        {/* Mobile menu overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, x: -300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -300 }}
              className="lg:hidden fixed inset-0 z-50 bg-card"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <Link href="/admin/overview" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-semibold">FinFlow Admin</span>
                  </Link>
                  <button onClick={() => setMobileMenuOpen(false)}>
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <nav className="space-y-1">
                  {adminNav.map((item) => {
                    const active = isRouteActive(pathname, item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                          active
                            ? 'bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 font-semibold border border-violet-200'
                            : 'text-foreground/50 hover:bg-accent'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>

                <div className="mt-6 pt-6 border-t flex flex-col gap-3">
                  <button
                    onClick={() => { router.push('/dashboard'); setMobileMenuOpen(false); }}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-foreground/60 hover:bg-accent"
                  >
                    <Sparkles className="h-4 w-4" />
                    User Dashboard
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="p-4 lg:p-6 pb-20 lg:pb-6">{children}</main>
      </div>
    </div>
  );
}