import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Mail, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api";

type NotificationSettings = {
  email: {
    transactions: boolean;
    budgetAlerts: boolean;
    goalMilestones: boolean;
    weeklyReport: boolean;
    monthlyReport: boolean;
    marketing: boolean;
  };
  push: {
    transactions: boolean;
    budgetAlerts: boolean;
    goalMilestones: boolean;
    billReminders: boolean;
  };
  inApp: {
    transactions: boolean;
    budgetAlerts: boolean;
    insights: boolean;
    tips: boolean;
  };
};

const defaultSettings: NotificationSettings = {
  email: {
    transactions: true,
    budgetAlerts: true,
    goalMilestones: true,
    weeklyReport: true,
    monthlyReport: false,
    marketing: false,
  },
  push: {
    transactions: true,
    budgetAlerts: true,
    goalMilestones: true,
    billReminders: true,
  },
  inApp: {
    transactions: true,
    budgetAlerts: true,
    insights: true,
    tips: true,
  },
};

export function Notifications() {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);

      try {
        const response = await apiRequest<{ settings: NotificationSettings }>("/auth/notifications", {
          method: "GET",
          auth: true,
        });

        setSettings(response.settings || defaultSettings);
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(err.message || "Failed to load notification settings");
        } else {
          toast.error("Failed to load notification settings");
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchSettings();
  }, []);

  const handleToggle = async (
    category: "email" | "push" | "inApp",
    key: string,
    value: boolean
  ) => {
    const previous = settings;
    const next = {
      ...settings,
      [category]: {
        ...settings[category],
        [key]: value,
      },
    } as NotificationSettings;

    setSettings(next);

    try {
      await apiRequest<{ settings: NotificationSettings }>("/auth/notifications", {
        method: "PUT",
        auth: true,
        body: JSON.stringify({ settings: next }),
      });

      toast.success(value ? "Notification enabled" : "Notification disabled");
    } catch (err) {
      setSettings(previous);

      if (err instanceof ApiError) {
        toast.error(err.message || "Failed to update notification settings");
      } else {
        toast.error("Failed to update notification settings");
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-2">Notification Settings</h1>
        <p className="text-foreground/60">Manage how you receive notifications</p>
      </div>

      {loading ? (
        <Card className="p-6 rounded-3xl border-2">
          <p className="text-sm text-foreground/60">Loading notification settings...</p>
        </Card>
      ) : (
      <>
      {/* Email Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#dcfce7] flex items-center justify-center">
              <Mail className="w-5 h-5 text-[#16a34a]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Email Notifications</h3>
              <p className="text-sm text-foreground/60">Receive updates via email</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3">
              <div>
                <Label>Transaction Alerts</Label>
                <p className="text-sm text-foreground/60">Get notified of new transactions</p>
              </div>
              <Switch
                checked={settings.email.transactions}
                onCheckedChange={(checked) => handleToggle("email", "transactions", checked)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-t">
              <div>
                <Label>Budget Alerts</Label>
                <p className="text-sm text-foreground/60">Alerts when approaching budget limits</p>
              </div>
              <Switch
                checked={settings.email.budgetAlerts}
                onCheckedChange={(checked) => handleToggle("email", "budgetAlerts", checked)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-t">
              <div>
                <Label>Goal Milestones</Label>
                <p className="text-sm text-foreground/60">Celebrate reaching your goals</p>
              </div>
              <Switch
                checked={settings.email.goalMilestones}
                onCheckedChange={(checked) => handleToggle("email", "goalMilestones", checked)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-t">
              <div>
                <Label>Weekly Report</Label>
                <p className="text-sm text-foreground/60">Summary of your week</p>
              </div>
              <Switch
                checked={settings.email.weeklyReport}
                onCheckedChange={(checked) => handleToggle("email", "weeklyReport", checked)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-t">
              <div>
                <Label>Monthly Report</Label>
                <p className="text-sm text-foreground/60">Summary of your month</p>
              </div>
              <Switch
                checked={settings.email.monthlyReport}
                onCheckedChange={(checked) => handleToggle("email", "monthlyReport", checked)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-t">
              <div>
                <Label>Marketing & Updates</Label>
                <p className="text-sm text-foreground/60">News and product updates</p>
              </div>
              <Switch
                checked={settings.email.marketing}
                onCheckedChange={(checked) => handleToggle("email", "marketing", checked)}
              />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Push Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#dbeafe] flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#2563eb]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Push Notifications</h3>
              <p className="text-sm text-foreground/60">Instant alerts on your device</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3">
              <div>
                <Label>Transaction Alerts</Label>
                <p className="text-sm text-foreground/60">Real-time transaction notifications</p>
              </div>
              <Switch
                checked={settings.push.transactions}
                onCheckedChange={(checked) => handleToggle("push", "transactions", checked)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-t">
              <div>
                <Label>Budget Alerts</Label>
                <p className="text-sm text-foreground/60">Instant budget warnings</p>
              </div>
              <Switch
                checked={settings.push.budgetAlerts}
                onCheckedChange={(checked) => handleToggle("push", "budgetAlerts", checked)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-t">
              <div>
                <Label>Goal Milestones</Label>
                <p className="text-sm text-foreground/60">Celebrate achievements instantly</p>
              </div>
              <Switch
                checked={settings.push.goalMilestones}
                onCheckedChange={(checked) => handleToggle("push", "goalMilestones", checked)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-t">
              <div>
                <Label>Bill Reminders</Label>
                <p className="text-sm text-foreground/60">Never miss a payment</p>
              </div>
              <Switch
                checked={settings.push.billReminders}
                onCheckedChange={(checked) => handleToggle("push", "billReminders", checked)}
              />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* In-App Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#f3e8ff] flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-[#9333ea]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">In-App Notifications</h3>
              <p className="text-sm text-foreground/60">Notifications within FinFlow</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3">
              <div>
                <Label>Transaction Updates</Label>
                <p className="text-sm text-foreground/60">See new transactions in-app</p>
              </div>
              <Switch
                checked={settings.inApp.transactions}
                onCheckedChange={(checked) => handleToggle("inApp", "transactions", checked)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-t">
              <div>
                <Label>Budget Alerts</Label>
                <p className="text-sm text-foreground/60">In-app budget notifications</p>
              </div>
              <Switch
                checked={settings.inApp.budgetAlerts}
                onCheckedChange={(checked) => handleToggle("inApp", "budgetAlerts", checked)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-t">
              <div>
                <Label>AI Insights</Label>
                <p className="text-sm text-foreground/60">Smart spending insights</p>
              </div>
              <Switch
                checked={settings.inApp.insights}
                onCheckedChange={(checked) => handleToggle("inApp", "insights", checked)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-t">
              <div>
                <Label>Finance Tips</Label>
                <p className="text-sm text-foreground/60">Helpful financial advice</p>
              </div>
              <Switch
                checked={settings.inApp.tips}
                onCheckedChange={(checked) => handleToggle("inApp", "tips", checked)}
              />
            </div>
          </div>
        </Card>
      </motion.div>
      </>
      )}
    </div>
  );
}
