import { motion } from "motion/react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Mail, Phone, MapPin, Calendar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function Account() {
  const [email, setEmail] = useState("alex@example.com");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleUpdateEmail = () => {
    toast.success("Email updated successfully");
  };

  const handleUpdatePassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    toast.success("Password updated successfully");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleDeleteAccount = () => {
    toast.error("Account deletion is not available in demo mode");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-2">Account Settings</h1>
        <p className="text-foreground/60">Manage your account and email preferences</p>
      </div>

      {/* Account Information */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <h3 className="text-lg font-semibold mb-4">Account Information</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-accent/50 rounded-xl">
              <Mail className="w-5 h-5 text-foreground/60" />
              <div className="flex-1">
                <div className="text-sm text-foreground/60">Email</div>
                <div className="font-medium">alex@example.com</div>
              </div>
              <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                Verified
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-accent/50 rounded-xl">
              <Calendar className="w-5 h-5 text-foreground/60" />
              <div className="flex-1">
                <div className="text-sm text-foreground/60">Member since</div>
                <div className="font-medium">January 2026</div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Change Email */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <h3 className="text-lg font-semibold mb-4">Change Email</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">New Email</Label>
              <Input
                id="new-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl"
                placeholder="Enter new email"
              />
            </div>
            <Button onClick={handleUpdateEmail} className="rounded-xl">
              Update Email
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Change Password */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <h3 className="text-lg font-semibold mb-4">Change Password</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="rounded-xl"
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="rounded-xl"
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-xl"
                placeholder="Confirm new password"
              />
            </div>
            <Button onClick={handleUpdatePassword} className="rounded-xl">
              Update Password
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Delete Account */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="p-6 rounded-3xl border-2 border-red-200 bg-red-50/50">
          <h3 className="text-lg font-semibold mb-2 text-red-600">Danger Zone</h3>
          <p className="text-sm text-foreground/60 mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button onClick={handleDeleteAccount} variant="destructive" className="rounded-xl">
            Delete Account
          </Button>
        </Card>
      </motion.div>
    </div>
  );
}
