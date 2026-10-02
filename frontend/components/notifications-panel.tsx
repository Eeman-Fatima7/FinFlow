"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, Bell, AlertCircle, Target, CheckCircle2, Lightbulb } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, apiRequest } from "@/lib/api";

type NotificationType = 'alert' | 'tip' | 'milestone';

type SuggestionApi = {
  suggestion_id: number;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info' | string;
  is_read: boolean;
  created_at: string;
};

interface Notification {
  id: string;
  suggestionId: number;
  type: NotificationType;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  link?: string;
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
}

const formatRelativeTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    const mins = Math.max(1, Math.round(diffMs / minute));
    return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  }

  if (diffMs < day) {
    const hours = Math.max(1, Math.round(diffMs / hour));
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.max(1, Math.round(diffMs / day));
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const toNotificationType = (severity: string): NotificationType => {
  if (severity === 'critical' || severity === 'warning') return 'alert';
  if (severity === 'info') return 'tip';
  return 'milestone';
};

const toNotificationLink = (type: NotificationType) => {
  if (type === 'alert') return '/dashboard/budget';
  if (type === 'tip') return '/dashboard/summary';
  return '/dashboard/goals';
};

export function NotificationsPanel({ isOpen, onClose, isMobile = false }: NotificationsPanelProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'alerts' | 'tips'>('all');
  const [notificationList, setNotificationList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadSuggestions = async () => {
      setLoading(true);

      try {
        const response = await apiRequest<{ suggestions: SuggestionApi[] }>("/suggestions", {
          method: "GET",
          auth: true,
          query: { limit: 50 },
        });

        const mapped = (response.suggestions || []).map((item) => {
          const type = toNotificationType(item.severity);

          return {
            id: String(item.suggestion_id),
            suggestionId: item.suggestion_id,
            type,
            title: item.title,
            description: item.description,
            time: formatRelativeTime(item.created_at),
            unread: !item.is_read,
            link: toNotificationLink(type),
          } satisfies Notification;
        });

        setNotificationList(mapped);
      } catch (err) {
        if (err instanceof ApiError) {
          setNotificationList([]);
        } else {
          setNotificationList([]);
        }
      } finally {
        setLoading(false);
      }
    };

    void loadSuggestions();
  }, [isOpen]);

  const filteredNotifications = useMemo(() => {
    return notificationList.filter((n) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'alerts') return n.type === 'alert' || n.type === 'milestone';
      if (activeTab === 'tips') return n.type === 'tip';
      return true;
    });
  }, [activeTab, notificationList]);

  const unreadCount = useMemo(
    () => notificationList.filter((n) => n.unread).length,
    [notificationList]
  );

  const markAllAsRead = async () => {
    const unread = notificationList.filter((n) => n.unread);
    if (unread.length === 0) return;

    const previous = notificationList;
    setNotificationList((current) => current.map((n) => ({ ...n, unread: false })));

    try {
      await Promise.all(
        unread.map((item) =>
          apiRequest(`/suggestions/${item.suggestionId}/read`, {
            method: 'PATCH',
            auth: true,
          })
        )
      );
    } catch {
      setNotificationList(previous);
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'alert':
        return <AlertCircle className="w-5 h-5 text-[#f97316]" />;
      case 'milestone':
        return <Target className="w-5 h-5 text-[#2563eb]" />;
      case 'tip':
        return <Lightbulb className="w-5 h-5 text-[#eab308]" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={isMobile ? { x: '100%' } : { x: 400, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { x: 0, opacity: 1 }}
            exit={isMobile ? { x: '100%' } : { x: 400, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={`fixed ${isMobile ? 'inset-0' : 'top-0 right-0 bottom-0 w-[400px]'} bg-card shadow-2xl z-50 flex flex-col overflow-hidden`}
          >
            {/* Header */}
            <div className="shrink-0 border-b px-6 py-4 bg-background">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c084fc] to-[#f9a8d4] flex items-center justify-center">
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Notifications</h2>
                    {unreadCount > 0 && (
                      <p className="text-xs text-foreground/60">{unreadCount} unread</p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'all'
                      ? 'bg-gradient-to-r from-[#dcfce7] to-[#cffafe] text-primary'
                      : 'text-foreground/60 hover:bg-accent'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveTab('alerts')}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'alerts'
                      ? 'bg-gradient-to-r from-[#dcfce7] to-[#cffafe] text-primary'
                      : 'text-foreground/60 hover:bg-accent'
                  }`}
                >
                  Alerts
                </button>
                <button
                  onClick={() => setActiveTab('tips')}
                  className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === 'tips'
                      ? 'bg-gradient-to-r from-[#dcfce7] to-[#cffafe] text-primary'
                      : 'text-foreground/60 hover:bg-accent'
                  }`}
                >
                  Tips
                </button>
              </div>
            </div>

            {/* Mark all as read */}
            {unreadCount > 0 && (
              <div className="shrink-0 px-6 py-3 border-b bg-background">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={markAllAsRead}
                  className="text-xs text-primary hover:bg-accent"
                >
                  <CheckCircle2 className="w-3 h-3 mr-2" />
                  Mark all as read
                </Button>
              </div>
            )}

            {/* Notifications list */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
              {loading ? (
                <div className="flex items-center justify-center h-full p-8 text-center">
                  <p className="text-foreground/60">Loading notifications...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
                    <Bell className="w-8 h-8 text-foreground/40" />
                  </div>
                  <p className="text-foreground/60">No notifications yet</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {filteredNotifications.map((notification) => (
                    <Link
                      key={notification.id}
                      href={notification.link || '/dashboard'}
                      onClick={onClose}
                    >
                      <Card
                        className={`p-4 rounded-2xl border-2 hover:shadow-md transition-all cursor-pointer ${
                          notification.unread ? 'bg-[#dcfce7]/30' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className="mt-0.5">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="text-sm font-semibold">{notification.title}</h4>
                              {notification.unread && (
                                <span className="w-2 h-2 rounded-full bg-[#f9a8d4] flex-shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-xs text-foreground/70 mb-2 leading-relaxed">
                              {notification.description}
                            </p>
                            <span className="text-xs text-foreground/50">{notification.time}</span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}