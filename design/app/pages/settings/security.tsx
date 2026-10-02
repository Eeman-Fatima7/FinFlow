import { motion } from "motion/react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Shield, Smartphone, Key, Clock, CheckCircle, Eye, EyeOff, AlertCircle, Check } from "lucide-react";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Link } from "react-router";
import { useUnsavedChanges } from "../../../hooks/use-unsaved-changes";

export function Security() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(true);

  // Password Change State
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    new: "",
    confirm: ""
  });
  
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const [signOutAll, setSignOutAll] = useState(false);
  const [isPasswordDirty, setIsPasswordDirty] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string;
    new?: string;
    confirm?: string;
  }>({});

  // Use the hook to warn about unsaved changes
  useUnsavedChanges(isPasswordDirty);

  // Check password strength
  const hasMinLength = passwordForm.new.length >= 8;
  const hasUpper = /[A-Z]/.test(passwordForm.new);
  const hasLower = /[a-z]/.test(passwordForm.new);
  const hasNumber = /[0-9]/.test(passwordForm.new);
  const isStrong = hasMinLength && hasUpper && hasLower && hasNumber;

  const handlePasswordChange = (field: keyof typeof passwordForm, value: string) => {
    setPasswordForm(prev => {
      const updated = { ...prev, [field]: value };
      setIsPasswordDirty(updated.current !== "" || updated.new !== "" || updated.confirm !== "");
      return updated;
    });
    
    // Clear error for field
    if (passwordErrors[field]) {
      setPasswordErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const toggleShowPassword = (field: keyof typeof showPassword) => {
    setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSavePassword = () => {
    const errors: typeof passwordErrors = {};
    
    if (!passwordForm.current) errors.current = "Current password is required";
    if (!passwordForm.new) errors.new = "New password is required";
    else if (!isStrong) errors.new = "Password does not meet requirements";
    
    if (passwordForm.new !== passwordForm.confirm) {
      errors.confirm = "Passwords do not match";
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      toast.error("Please fix errors");
      return;
    }

    // Mock API call
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1000)),
      {
        loading: "Updating password...",
        success: () => {
          setPasswordForm({ current: "", new: "", confirm: "" });
          setIsPasswordDirty(false);
          setSignOutAll(false);
          return "Password changed successfully";
        },
        error: "Failed to update password"
      }
    );

    if (signOutAll) {
      // Logic to clear session would go here
      // For now just toast
      setTimeout(() => {
        toast.info("Signed out of all other sessions");
      }, 1500);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-2">Security</h1>
        <p className="text-foreground/60">Manage your account security settings</p>
      </div>

      {/* Two-Factor Authentication */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#dcfce7] flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-[#16a34a]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Two-Factor Authentication</h3>
              <p className="text-sm text-foreground/60 mb-4">
                Add an extra layer of security to your account by requiring a verification code in addition to your password.
              </p>
              <div className="flex items-center justify-between p-4 bg-accent/50 rounded-xl mb-4">
                <div className="flex items-center gap-3">
                  {twoFactorEnabled ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium">2FA Enabled</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5 text-foreground/40" />
                      <span className="text-sm font-medium">2FA Disabled</span>
                    </>
                  )}
                </div>
                <Switch
                  checked={twoFactorEnabled}
                  onCheckedChange={(checked) => {
                    setTwoFactorEnabled(checked);
                    toast.success(checked ? "2FA enabled" : "2FA disabled");
                  }}
                />
              </div>
              {!twoFactorEnabled && (
                <Button className="rounded-xl">Setup Two-Factor Authentication</Button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Change Password Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#fef3c7] flex items-center justify-center flex-shrink-0">
              <Key className="w-6 h-6 text-[#f59e0b]" />
            </div>
            <div className="flex-1 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Change Password</h3>
                <p className="text-sm text-foreground/60">
                  Update your password to keep your account secure.
                </p>
              </div>

              <div className="space-y-4 max-w-md">
                {/* Current Password */}
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showPassword.current ? "text" : "password"}
                      value={passwordForm.current}
                      onChange={(e) => handlePasswordChange("current", e.target.value)}
                      className={`rounded-xl pr-10 ${passwordErrors.current ? "border-red-500" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowPassword("current")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground"
                    >
                      {showPassword.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordErrors.current && (
                    <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {passwordErrors.current}</p>
                  )}
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword.new ? "text" : "password"}
                      value={passwordForm.new}
                      onChange={(e) => handlePasswordChange("new", e.target.value)}
                      className={`rounded-xl pr-10 ${passwordErrors.new ? "border-red-500" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowPassword("new")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground"
                    >
                      {showPassword.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {/* Password Strength Indicators */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className={`text-xs flex items-center gap-1.5 ${hasMinLength ? "text-green-600" : "text-foreground/40"}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? "bg-green-600" : "bg-foreground/20"}`} />
                      8+ characters
                    </div>
                    <div className={`text-xs flex items-center gap-1.5 ${hasUpper ? "text-green-600" : "text-foreground/40"}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${hasUpper ? "bg-green-600" : "bg-foreground/20"}`} />
                      Uppercase letter
                    </div>
                    <div className={`text-xs flex items-center gap-1.5 ${hasLower ? "text-green-600" : "text-foreground/40"}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${hasLower ? "bg-green-600" : "bg-foreground/20"}`} />
                      Lowercase letter
                    </div>
                    <div className={`text-xs flex items-center gap-1.5 ${hasNumber ? "text-green-600" : "text-foreground/40"}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${hasNumber ? "bg-green-600" : "bg-foreground/20"}`} />
                      Number
                    </div>
                  </div>

                  {passwordErrors.new && (
                    <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" /> {passwordErrors.new}</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showPassword.confirm ? "text" : "password"}
                      value={passwordForm.confirm}
                      onChange={(e) => handlePasswordChange("confirm", e.target.value)}
                      className={`rounded-xl pr-10 ${passwordErrors.confirm ? "border-red-500" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowPassword("confirm")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground"
                    >
                      {showPassword.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordErrors.confirm && (
                    <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {passwordErrors.confirm}</p>
                  )}
                </div>

                {/* Sign Out Toggle */}
                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="sign-out-all" className="cursor-pointer">Sign out of all other sessions</Label>
                  <Switch
                    id="sign-out-all"
                    checked={signOutAll}
                    onCheckedChange={setSignOutAll}
                  />
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-col gap-3">
                  <Button 
                    onClick={handleSavePassword} 
                    className="w-full rounded-xl"
                    disabled={!isPasswordDirty || !isStrong || !passwordForm.current || passwordForm.new !== passwordForm.confirm}
                  >
                    Update Password
                  </Button>
                  <div className="text-center">
                    <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Biometric Authentication */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-6 h-6 text-[#2563eb]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Biometric Authentication</h3>
              <p className="text-sm text-foreground/60 mb-4">
                Use Face ID, Touch ID, or fingerprint to quickly and securely access your account.
              </p>
              <div className="flex items-center justify-between">
                <Label>Enable Biometric Login</Label>
                <Switch
                  checked={biometricsEnabled}
                  onCheckedChange={(checked) => {
                    setBiometricsEnabled(checked);
                    toast.success(checked ? "Biometric login enabled" : "Biometric login disabled");
                  }}
                />
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Session Management */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#f3e8ff] flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6 text-[#9333ea]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Session Management</h3>
              <p className="text-sm text-foreground/60 mb-4">
                Manage your active sessions and security preferences.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <Label>Auto Sign Out</Label>
                    <p className="text-sm text-foreground/60">Sign out after 30 minutes of inactivity</p>
                  </div>
                  <Switch
                    checked={sessionTimeout}
                    onCheckedChange={(checked) => {
                      setSessionTimeout(checked);
                      toast.success(checked ? "Auto sign out enabled" : "Auto sign out disabled");
                    }}
                  />
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-3">Active Sessions</h4>
                  <div className="space-y-3">
                    <div className="p-4 bg-accent/50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                            <Smartphone className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-medium">Current Device</div>
                            <div className="text-sm text-foreground/60">Chrome on macOS • San Francisco, CA</div>
                          </div>
                        </div>
                        <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          Active Now
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full mt-3 rounded-xl">
                    Sign Out All Other Sessions
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
