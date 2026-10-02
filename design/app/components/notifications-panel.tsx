import { motion, AnimatePresence } from "motion/react";
import { X, Bell, AlertCircle, Target, Receipt, CheckCircle2, Lightbulb } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { useState } from "react";
import { Link } from "react-router";

type NotificationType = 'alert' | 'tip' | 'milestone';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  link?: string;
}

const notifications: Notification[] = [
  {
    id: '1',
    type: 'alert',
    title: 'Budget limit approaching',
    description: 'You have spent 90% of your Dining Out budget this month',
    time: '2 hours ago',
    unread: true,
    link: '/app/budget'
  },
  {
    id: '2',
    type: 'milestone',
    title: 'Goal milestone reached! 🎉',
    description: 'You have reached 75% of your Emergency Fund goal',
    time: '1 day ago',
    unread: true,
    link: '/app/goals'
  },
  {
    id: '3',
    type: 'alert',
    title: 'Large transaction detected',
    description: '$1,245.00 charged at Apple Store',
    time: '2 days ago',
    unread: false,
    link: '/app/transactions'
  },
  {
    id: '4',
    type: 'tip',
    title: 'Save more on subscriptions',
    description: 'You have 3 subscriptions that could be cancelled to save $45/month',
    time: '3 days ago',
    unread: false,
    link: '/app/transactions'
  },
  {
    id: '5',
    type: 'milestone',
    title: 'Spending streak!',
    description: 'You stayed under budget for 7 days in a row',
    time: '1 week ago',
    unread: false,
    link: '/app/budget'
  }
];

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
}

export function NotificationsPanel({ isOpen, onClose, isMobile = false }: NotificationsPanelProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'alerts' | 'tips'>('all');
  const [notificationList, setNotificationList] = useState(notifications);

  const filteredNotifications = notificationList.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'alerts') return n.type === 'alert' || n.type === 'milestone';
    if (activeTab === 'tips') return n.type === 'tip';
    return true;
  });

  const unreadCount = notificationList.filter(n => n.unread).length;

  const markAllAsRead = () => {
    setNotificationList(notificationList.map(n => ({ ...n, unread: false })));
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
              {filteredNotifications.length === 0 ? (
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
                      to={notification.link || '/app'}
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