import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sun, Moon, Monitor } from "lucide-react";
import { toast } from "sonner";
import { type Currency, type DateFormat, type Language, usePreferences } from "@/lib/preferences";

export function Preferences() {
  const { preferences, updatePreferences } = usePreferences();

  const handleThemeChange = (value: "light" | "dark" | "system") => {
    updatePreferences({ theme: value });
    toast.success(`Theme changed to ${value}`);
  };

  const handleCurrencyChange = (value: string) => {
    updatePreferences({ currency: value as Currency });
    toast.success(`Currency changed to ${value}`);
  };

  const handleDateFormatChange = (value: string) => {
    updatePreferences({ dateFormat: value as DateFormat });
    toast.success(`Date format changed to ${value}`);
  };

  const handleLanguageChange = (value: string) => {
    updatePreferences({ language: value as Language });
    toast.success(`Language changed to ${value}`);
  };

  const handleCompactModeChange = (checked: boolean) => {
    updatePreferences({ compactMode: checked });
    toast.success(checked ? "Compact mode enabled" : "Compact mode disabled");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-2">Preferences</h1>
        <p className="text-foreground/60">Customize your FinFlow experience</p>
      </div>

      {/* Appearance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <h3 className="text-lg font-semibold mb-4">Appearance</h3>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Theme</Label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleThemeChange("light")}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    preferences.theme === "light"
                      ? "border-primary bg-accent"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Sun className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-sm font-medium">Light</div>
                </button>

                <button
                  onClick={() => handleThemeChange("dark")}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    preferences.theme === "dark"
                      ? "border-primary bg-accent"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Moon className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-sm font-medium">Dark</div>
                </button>

                <button
                  onClick={() => handleThemeChange("system")}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    preferences.theme === "system"
                      ? "border-primary bg-accent"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Monitor className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-sm font-medium">System</div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Compact Mode</Label>
                <p className="text-sm text-foreground/60">Show more content in less space</p>
              </div>
              <Switch
                checked={preferences.compactMode}
                onCheckedChange={handleCompactModeChange}
              />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Regional Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <h3 className="text-lg font-semibold mb-4">Regional Settings</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={preferences.currency} onValueChange={handleCurrencyChange}>
                <SelectTrigger id="currency" className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                  <SelectItem value="PKR">PKR - Pakistani Rupee (Rs)</SelectItem>
                  <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
                  <SelectItem value="AED">AED - UAE Dirham (AED)</SelectItem>
                  <SelectItem value="CAD">CAD - Canadian Dollar (CA$)</SelectItem>
                  <SelectItem value="AUD">AUD - Australian Dollar (A$)</SelectItem>
                  <SelectItem value="JPY">JPY - Japanese Yen (¥)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-format">Date Format</Label>
              <Select value={preferences.dateFormat} onValueChange={handleDateFormatChange}>
                <SelectTrigger id="date-format" className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select value={preferences.language} onValueChange={handleLanguageChange}>
                <SelectTrigger id="language" className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ur">اردو (Urdu)</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
