import { motion } from "motion/react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { User, Camera, AlertCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useUser, UserProfile } from "../../providers/user-provider";
import { normalizePhone, formatPhone, validatePhone } from "../../../utils/phoneUtils";
import { useUnsavedChanges } from "../../../hooks/use-unsaved-changes";

export function Profile() {
  const { user, updateUser } = useUser();
  const [formData, setFormData] = useState<UserProfile>(() => ({
    ...user,
    phone: formatPhone(user.phone)
  }));
  const [isDirty, setIsDirty] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof UserProfile, string>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with user context only if not dirty
  useEffect(() => {
    if (!isDirty) {
      setFormData({
        ...user,
        phone: formatPhone(user.phone)
      });
    }
  }, [user, isDirty]);

  // Handle unsaved changes warning
  useUnsavedChanges(isDirty);

  const handleChange = (field: keyof UserProfile, value: string) => {
    let newValue = value;
    
    // Live formatting for phone
    if (field === "phone") {
      newValue = formatPhone(value);
    }

    setFormData((prev) => {
      const newData = { ...prev, [field]: newValue };
      // Check dirty state against normalized user data for phone comparisons
      // But user.phone is stored as normalized (ideally). 
      // If user.phone is "+92...", and newData.phone is "+92 ...", we need to compare apples to apples.
      // Let's just compare basic stringify for now, but handle phone specifically if needed.
      // Actually, cleaner is to normalize `newData.phone` and compare to `user.phone`.
      const normalizedNew = {
        ...newData,
        phone: field === "phone" ? normalizePhone(newValue) : newData.phone
      };
      // user.phone should be normalized.
      // If user.phone is not normalized in DB, this might cause initial dirty. 
      // But we assume it is or will be.
      
      const isPhoneDirty = normalizePhone(newValue) !== normalizePhone(user.phone);
      const isOtherDirty = Object.keys(user).some(k => 
        k !== "phone" && k !== "avatarUrl" && user[k as keyof UserProfile] !== newData[k as keyof UserProfile]
      );
      // avatarUrl check
      const isAvatarDirty = user.avatarUrl !== newData.avatarUrl;

      setIsDirty(isPhoneDirty || isOtherDirty || isAvatarDirty);
      return newData;
    });

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleBlur = (field: keyof UserProfile) => {
    if (field === "phone") {
      const error = validatePhone(formData.phone);
      if (error) {
        setErrors((prev) => ({ ...prev, phone: error }));
      }
    }
  };

  const handleSave = () => {
    // Validation
    const newErrors: Partial<Record<keyof UserProfile, string>> = {};
    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Invalid email address";
    
    const phoneError = validatePhone(formData.phone);
    if (phoneError) {
      newErrors.phone = phoneError;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fix the errors before saving");
      return;
    }

    // Save normalized phone
    updateUser({
      ...formData,
      phone: normalizePhone(formData.phone)
    });
    setIsDirty(false);
    toast.success("Profile updated");
  };

  const handleCancel = () => {
    setFormData({
      ...user,
      phone: formatPhone(user.phone)
    });
    setIsDirty(false);
    setErrors({});
    toast.info("Changes discarded");
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB
      toast.error("Image must be smaller than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFormData((prev) => ({ ...prev, avatarUrl: result }));
      setIsDirty(true);
    };
    reader.readAsDataURL(file);
    
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleRemovePhoto = () => {
    setFormData((prev) => ({ ...prev, avatarUrl: null }));
    setIsDirty(true);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-2">Profile</h1>
        <p className="text-foreground/60">Manage your profile information</p>
      </div>

      {/* Profile Photo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <h3 className="text-lg font-semibold mb-4">Profile Photo</h3>
          <div className="flex items-center gap-6">
            <div className="relative">
              {formData.avatarUrl ? (
                <img 
                  src={formData.avatarUrl} 
                  alt="Profile" 
                  className="w-24 h-24 rounded-full object-cover border-2 border-border" 
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#c084fc] to-[#f9a8d4] flex items-center justify-center">
                  <User className="w-12 h-12 text-white" />
                </div>
              )}
              <button 
                onClick={handleFileClick}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center hover:bg-accent transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4 text-foreground" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange}
              />
            </div>
            <div className="flex-1">
              <h4 className="font-medium mb-1">Change profile photo</h4>
              <p className="text-sm text-foreground/60 mb-3">
                Upload a new photo or remove the current one. Max 2MB.
              </p>
              <div className="flex gap-3">
                <Button size="sm" className="rounded-xl" onClick={handleFileClick}>Upload Photo</Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={handleRemovePhoto}>Remove</Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Personal Information */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  className={`rounded-xl ${errors.fullName ? "border-red-500" : ""}`}
                />
                {errors.fullName && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.fullName}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className={`rounded-xl ${errors.email ? "border-red-500" : ""}`}
                />
                {errors.email && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.email}</p>}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  onBlur={() => handleBlur("phone")}
                  className={`rounded-xl ${errors.phone ? "border-red-500" : ""}`}
                  placeholder="0300 1234567"
                />
                <p className="text-xs text-foreground/60 mt-1">Pakistan: 03XX XXXXXXX or +92 3XX XXXXXXX</p>
                {errors.phone && <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertCircle className="w-3 h-3" /> {errors.phone}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleChange("bio", e.target.value)}
                className="rounded-xl"
                rows={4}
                placeholder="Tell us about yourself..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" className="rounded-xl" onClick={handleCancel} disabled={!isDirty}>Cancel</Button>
            <Button onClick={handleSave} className="rounded-xl" disabled={!isDirty}>Save Changes</Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
