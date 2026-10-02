import { 
  User, 
  Settings, 
  CreditCard, 
  Globe, 
  LogOut, 
  Crown,
  Bell,
  Shield,
  HelpCircle,
  UserCircle,
  ChevronDown
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { useUser } from "../providers/user-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "./ui/card";

interface AccountMenuProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenPlanBilling?: () => void;
}

export function AccountMenu({ open, onOpenChange, onOpenPlanBilling }: AccountMenuProps) {
  const navigate = useNavigate();
  const { user } = useUser();

  const handleSignOut = () => {
    // Clear all FinFlow session data
    localStorage.removeItem("finflow.auth");
    localStorage.removeItem("finflow.user");
    localStorage.removeItem("finflow.token");
    localStorage.removeItem("finflow.session");
    
    toast.success("Signed out successfully");
    onOpenChange?.(false);
    
    // Navigate to sign in page
    navigate("/signin");
  };

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button 
          type="button"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-accent transition-colors cursor-pointer"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#c084fc] to-[#f9a8d4] flex items-center justify-center overflow-hidden shrink-0">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-medium truncate">{user.fullName}</div>
            <div className="text-xs text-foreground/60">Free plan</div>
          </div>
          <ChevronDown className={`w-4 h-4 text-foreground/60 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        side="top" 
        align="start" 
        sideOffset={8}
        className="w-72 rounded-xl border-2 bg-popover p-3 shadow-xl z-[200] max-h-[70vh] overflow-y-auto scrollbar-hide"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Profile section */}
        <div className="flex items-center gap-3 p-2 mb-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c084fc] to-[#f9a8d4] flex items-center justify-center overflow-hidden shrink-0">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{user.fullName}</div>
            <div className="text-xs text-foreground/60">{user.email}</div>
          </div>
        </div>

        {/* Plan badge */}
        <div className="mx-2 mb-3 px-3 py-2 bg-gradient-to-r from-accent to-accent/50 rounded-xl">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Free Plan</span>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Menu items */}
        <DropdownMenuItem asChild>
          <Link to="/app/settings/profile" className="flex items-center gap-3 px-2 py-2 cursor-pointer">
            <UserCircle className="w-4 h-4 text-foreground/60" />
            <span className="text-sm">Profile</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link to="/app/settings/account" className="flex items-center gap-3 px-2 py-2 cursor-pointer">
            <Settings className="w-4 h-4 text-foreground/60" />
            <span className="text-sm">Account Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link to="/app/settings/preferences" className="flex items-center gap-3 px-2 py-2 cursor-pointer">
            <Globe className="w-4 h-4 text-foreground/60" />
            <span className="text-sm">Preferences</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link to="/app/settings/notifications" className="flex items-center gap-3 px-2 py-2 cursor-pointer">
            <Bell className="w-4 h-4 text-foreground/60" />
            <span className="text-sm">Notifications</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link to="/app/settings/security" className="flex items-center gap-3 px-2 py-2 cursor-pointer">
            <Shield className="w-4 h-4 text-foreground/60" />
            <span className="text-sm">Security</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem 
          onSelect={(e) => {
            e.preventDefault();
            onOpenChange?.(false);
            onOpenPlanBilling?.();
          }}
          className="cursor-pointer"
        >
          <div className="flex items-center gap-3 px-2 py-1 w-full">
            <CreditCard className="w-4 h-4 text-foreground/60" />
            <div className="flex-1">
              <div className="text-sm">Billing & Plans</div>
              <div className="text-xs text-foreground/50">Manage subscription</div>
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Help & Support */}
        <DropdownMenuItem asChild>
          <Link to="/app/support" className="flex items-center gap-3 px-2 py-2 cursor-pointer">
            <HelpCircle className="w-4 h-4 text-foreground/60" />
            <span className="text-sm">Help & Support</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuItem 
          variant="destructive"
          onSelect={handleSignOut}
          className="cursor-pointer"
        >
          <div className="flex items-center gap-3 px-2 py-1 w-full">
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Sign out</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Plan & Billing Modal Component
interface PlanBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PlanBillingModal({ isOpen, onClose }: PlanBillingModalProps) {
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
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 rounded-3xl border-2 pointer-events-auto">
              {/* Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Plan & Billing</h2>
                <p className="text-foreground/60">Manage your subscription and billing</p>
              </div>

              {/* Current plan */}
              <div className="mb-8">
                <Card className="p-6 rounded-2xl border-2 bg-gradient-to-br from-accent to-white">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-sm text-foreground/60 mb-1">Current Plan</div>
                      <div className="text-3xl font-bold">Free</div>
                    </div>
                    <div className="px-3 py-1 bg-accent rounded-full text-xs font-medium">
                      Active
                    </div>
                  </div>
                  <p className="text-sm text-foreground/70 mb-4">
                    Basic features for getting started
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>Up to 100 transactions/month</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>Basic budget tracking</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>Manual transaction entry</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Upgrade options */}
              <div className="mb-6">
                <h3 className="font-semibold mb-4">Upgrade your plan</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Pro plan */}
                  <Card className="p-6 rounded-2xl border-2 hover:border-primary hover:shadow-lg transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <Crown className="w-5 h-5 text-primary" />
                      <h4 className="font-bold text-lg">Pro</h4>
                    </div>
                    <div className="text-3xl font-bold mb-2">$12<span className="text-base font-normal text-foreground/60">/mo</span></div>
                    <p className="text-sm text-foreground/60 mb-4">Everything in Free, plus:</p>
                    <ul className="space-y-2 text-sm mb-6">
                      <li className="flex gap-2">
                        <span className="text-primary">✓</span>
                        <span>Unlimited transactions</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">✓</span>
                        <span>AI-powered insights</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">✓</span>
                        <span>Voice input</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">✓</span>
                        <span>Goal tracking (unlimited)</span>
                      </li>
                    </ul>
                    <Link to="/pricing">
                      <Button className="w-full rounded-xl">Upgrade to Pro</Button>
                    </Link>
                  </Card>

                  {/* Team plan */}
                  <Card className="p-6 rounded-2xl border-2 hover:border-primary hover:shadow-lg transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <Crown className="w-5 h-5 text-primary" />
                      <h4 className="font-bold text-lg">Team</h4>
                    </div>
                    <div className="text-3xl font-bold mb-2">$29<span className="text-base font-normal text-foreground/60">/mo</span></div>
                    <p className="text-sm text-foreground/60 mb-4">Everything in Pro, plus:</p>
                    <ul className="space-y-2 text-sm mb-6">
                      <li className="flex gap-2">
                        <span className="text-primary">✓</span>
                        <span>Up to 5 team members</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">✓</span>
                        <span>Shared budgets & goals</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">✓</span>
                        <span>Real-time sync</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-primary">✓</span>
                        <span>Advanced permissions</span>
                      </li>
                    </ul>
                    <Link to="/pricing">
                      <Button className="w-full rounded-xl" variant="outline">Upgrade to Team</Button>
                    </Link>
                  </Card>
                </div>
              </div>

              {/* Close button */}
              <div className="flex justify-end">
                <Button variant="outline" onClick={onClose} className="rounded-xl">
                  Close
                </Button>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}