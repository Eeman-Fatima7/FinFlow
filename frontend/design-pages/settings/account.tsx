import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Mail, Calendar } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";

export function Account() {
  const router = useRouter();
  const { user, refreshUser, logout } = useAuth();

  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    setEmail(user?.email || "");
  }, [user?.email]);

  const memberSince = useMemo(() => {
    if (!user?.created_at) return "—";
    const date = new Date(user.created_at);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [user?.created_at]);

  const handleUpdateEmail = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!user) {
      toast.error("Unable to load account data");
      return;
    }

    if (!trimmedEmail) {
      toast.error("Email is required");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Please enter a valid email");
      return;
    }

    setIsUpdatingEmail(true);

    try {
      await apiRequest<{ message: string; user: unknown }>("/auth/me", {
        method: "PUT",
        auth: true,
        body: JSON.stringify({
          name: user.name,
          email: trimmedEmail,
        }),
      });

      await refreshUser();
      toast.success("Email updated successfully");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message || "Failed to update email");
      } else {
        toast.error("Failed to update email");
      }
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      await apiRequest<{ message: string }>("/auth/password", {
        method: "PUT",
        auth: true,
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message || "Failed to update password");
      } else {
        toast.error("Failed to update password");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);

    try {
      await apiRequest<{ message: string }>("/auth/me", {
        method: "DELETE",
        auth: true,
      });

      logout();
      clearToken();
      if (typeof window !== "undefined") {
        localStorage.removeItem("finflow.user");
        localStorage.removeItem("finflow.app-user");
        localStorage.removeItem("finflow.session");
      }
      toast.success("Account deleted successfully");
      router.replace("/login");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message || "Failed to delete account");
      } else {
        toast.error("Failed to delete account");
      }
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Account Settings</h1>
        <p className="text-foreground/60">Manage your account and email preferences</p>
      </div>

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
                <div className="font-medium">{user?.email || "—"}</div>
              </div>
              <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                Verified
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-accent/50 rounded-xl">
              <Calendar className="w-5 h-5 text-foreground/60" />
              <div className="flex-1">
                <div className="text-sm text-foreground/60">Member since</div>
                <div className="font-medium">{memberSince}</div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

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
            <Button onClick={handleUpdateEmail} className="rounded-xl" disabled={isUpdatingEmail || !user}>
              {isUpdatingEmail ? "Updating..." : "Update Email"}
            </Button>
          </div>
        </Card>
      </motion.div>

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
            <Button onClick={handleUpdatePassword} className="rounded-xl" disabled={isUpdatingPassword || !user}>
              {isUpdatingPassword ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </Card>
      </motion.div>

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

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <Button
              onClick={() => setDeleteDialogOpen(true)}
              variant="destructive"
              className="rounded-xl"
              disabled={isDeleting || !user}
            >
              Delete Account
            </Button>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove your account and related data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} disabled={isDeleting}>
                  {isDeleting ? "Deleting..." : "Delete Account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      </motion.div>
    </div>
  );
}
