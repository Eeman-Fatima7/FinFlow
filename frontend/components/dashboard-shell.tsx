'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Receipt,
  MessageSquare,
  Mic,
  Target,
  Wallet,
  BarChart3,
  Bell,
  Search,
  User,
  Sparkles,
  Menu,
  X,
  Crown,
  UserCircle,
  Settings,
  Globe,
  CreditCard,
  HelpCircle,
  LogOut,
  Shield,
  LineChart,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { AccountMenu } from '@/components/account-menu';
import { NotificationsPanel } from '@/components/notifications-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transactions', href: '/dashboard/transactions', icon: Receipt },
  { name: 'AI Chat', href: '/dashboard/chat', icon: MessageSquare },
  { name: 'Voice Input', href: '/dashboard/voice', icon: Mic },
  { name: 'Goals', href: '/dashboard/goals', icon: Target },
  { name: 'Budget', href: '/dashboard/budget', icon: Wallet },
  { name: 'Summary', href: '/dashboard/summary', icon: BarChart3 },
  { name: 'Stocks', href: '/dashboard/stocks', icon: LineChart },
];

const isRouteActive = (pathname: string, href: string) =>
  href === '/dashboard' ? pathname === href : pathname.startsWith(href);

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const currentPage = useMemo(
    () => navigation.find((item) => isRouteActive(pathname, item.href))?.name || 'Dashboard',
    [pathname]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobileViewport(mediaQuery.matches);

    update();
    mediaQuery.addEventListener('change', update);

    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  const handleLogout = () => {
    logout();
    localStorage.removeItem('finflow.user');
    localStorage.removeItem('finflow.session');
    toast.success('Signed out successfully');
    setAccountMenuOpen(false);
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col border-r border-border bg-card">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto overflow-x-visible px-6 py-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold">FinFlow</span>
          </Link>

          <nav className="flex flex-1 flex-col gap-1">
            {navigation.map((item) => {
              const active = isRouteActive(pathname, item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition-all ${
                    active
                      ? 'bg-gradient-to-r from-[#dcfce7] to-[#cffafe] text-primary font-medium'
                      : 'text-foreground/60 hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t pt-4">
            <AccountMenu
              open={undefined}
              onOpenChange={undefined}
            />
          </div>
        </div>
      </aside>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
        <nav className="flex justify-around items-center h-16 px-2">
          {navigation.map((item) => {
            const active = isRouteActive(pathname, item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 ${
                  active ? 'text-primary' : 'text-foreground/60'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.name.split(' ')[0]}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-card/80 backdrop-blur-lg px-4 lg:px-8">
          <button className="lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          <h1 className="text-lg font-semibold flex-1">{currentPage}</h1>

          <div className="hidden md:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
              <Input placeholder="Search transactions..." className="pl-10 bg-accent/50 border-0 rounded-xl" />
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-xl"
            onClick={() => setNotificationsOpen(true)}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#f9a8d4] rounded-full" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl lg:hidden"
            onClick={() => setAccountMenuOpen(true)}
          >
            <User className="h-5 w-5" />
          </Button>
        </header>

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
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-semibold">FinFlow</span>
                  </Link>
                  <button onClick={() => setMobileMenuOpen(false)}>
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <nav className="space-y-2">
                  {navigation.map((item) => {
                    const active = isRouteActive(pathname, item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                          active
                            ? 'bg-gradient-to-r from-[#dcfce7] to-[#cffafe] text-primary font-medium'
                            : 'text-foreground/60 hover:bg-accent'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="p-4 lg:p-8 pb-20 lg:pb-8">{children}</main>
      </div>

      <NotificationsPanel
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        isMobile={isMobileViewport}
      />

      <div className="lg:hidden">
        <AnimatePresence>
          {accountMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setAccountMenuOpen(false)}
                className="fixed inset-0 bg-black/20 z-[90]"
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-0 left-0 right-0 z-[100] p-4"
              >
                <Card className="p-4 rounded-3xl border-2 shadow-2xl">
                  <div className="flex items-center gap-3 p-2 mb-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c084fc] to-[#f9a8d4] flex items-center justify-center overflow-hidden shrink-0 text-sm font-semibold text-white">
                      {(user?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{user?.name || 'User'}</div>
                      <div className="text-xs text-foreground/60">{user?.email || ''}</div>
                    </div>
                  </div>

                  <div className="mx-2 mb-3 px-3 py-2 bg-gradient-to-r from-accent to-accent/50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Free Plan</span>
                    </div>
                  </div>

                  <div className="h-px bg-border my-2" />

                  <div className="space-y-1">
                    <Link
                      href="/dashboard/profile"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors"
                    >
                      <UserCircle className="w-5 h-5 text-foreground/60" />
                      <span className="text-sm">Profile</span>
                    </Link>

                    <Link
                      href="/dashboard/settings/account"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors"
                    >
                      <Settings className="w-5 h-5 text-foreground/60" />
                      <span className="text-sm">Account Settings</span>
                    </Link>

                    <Link
                      href="/dashboard/settings/preferences"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors"
                    >
                      <Globe className="w-5 h-5 text-foreground/60" />
                      <span className="text-sm">Preferences</span>
                    </Link>

                    <Link
                      href="/dashboard/settings/notifications"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors"
                    >
                      <Bell className="w-5 h-5 text-foreground/60" />
                      <span className="text-sm">Notifications</span>
                    </Link>

                    <Link
                      href="/dashboard/settings/security"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors"
                    >
                      <Shield className="w-5 h-5 text-foreground/60" />
                      <span className="text-sm">Security</span>
                    </Link>

                    <Link
                      href="/dashboard/billing"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors"
                    >
                      <CreditCard className="w-5 h-5 text-foreground/60" />
                      <div className="flex-1">
                        <div className="text-sm">Billing & Plans</div>
                        <div className="text-xs text-foreground/50">Manage subscription</div>
                      </div>
                    </Link>
                  </div>

                  <div className="h-px bg-border my-2" />

                  <Link
                    href="/dashboard/support"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent transition-colors"
                  >
                    <HelpCircle className="w-5 h-5 text-foreground/60" />
                    <span className="text-sm">Help & Support</span>
                  </Link>

                  <div className="h-px bg-border my-2" />

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors text-left text-red-600"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-medium">Sign out</span>
                  </button>
                </Card>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
