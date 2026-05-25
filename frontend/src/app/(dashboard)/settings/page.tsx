"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getUserProfile, updateUserProfile, updateNotificationSettings, updateAISettings, deleteAccount } from "@/services/settings";
import { getStoredUser } from "@/lib/auth";
import { logout } from "@/lib/auth";
import toast from "react-hot-toast";

export default function NewSettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Profile state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  
  // Notification settings
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [whatsappNotifs, setWhatsappNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  
  // AI settings
  const [defaultTone, setDefaultTone] = useState("Professional");
  const [creativityLevel, setCreativityLevel] = useState(50);

  useEffect(() => {
    setMounted(true);
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const user = getStoredUser();
      if (user) {
        setFullName(user.full_name || "");
        setEmail(user.email || "");
        setUsername(user.username || "");
      }
      
      // In production, fetch from backend:
      // const profile = await getUserProfile();
      // setFullName(profile.full_name);
      // setEmail(profile.email);
      // setDefaultTone(profile.default_tone || "Professional");
      // setCreativityLevel(profile.creativity_level || 50);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateUserProfile({
        full_name: fullName,
        email,
        username,
      });
      
      // Update stored user
      const user = getStoredUser();
      if (user) {
        user.full_name = fullName;
        user.email = email;
        localStorage.setItem("user", JSON.stringify(user));
      }
      
      toast.success("Profile updated successfully!");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNotification = async (type: string, value: boolean) => {
    try {
      await updateNotificationSettings({
        [type]: value,
      });
      toast.success("Notification settings updated");
    } catch (error: any) {
      toast.error("Failed to update notifications");
      // Revert on error
      if (type === "email_notifications") setEmailNotifs(!value);
      if (type === "whatsapp_notifications") setWhatsappNotifs(!value);
      if (type === "push_notifications") setPushNotifs(!value);
    }
  };

  const handleSaveAISettings = async () => {
    try {
      await updateAISettings({
        default_tone: defaultTone,
        creativity_level: creativityLevel,
      });
      toast.success("AI settings updated!");
    } catch (error: any) {
      toast.error("Failed to update AI settings");
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure? This will permanently delete your account and all data.")) {
      return;
    }
    
    if (!confirm("This action CANNOT be undone. Type 'DELETE' to confirm.")) {
      return;
    }
    
    try {
      await deleteAccount();
      toast.success("Account deleted");
      logout();
    } catch (error: any) {
      toast.error("Failed to delete account");
    }
  };

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-container-lowest">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
      </div>
    );
  }

  return (
    <main className="md:ml-64 min-h-screen bg-surface-container-lowest p-lg">
      {/* Header */}
      <div className="mb-xl">
        <h1 className="font-display text-headline-lg font-bold text-on-surface">Settings</h1>
        <p className="text-on-surface-variant font-body-md mt-xs">
          Manage your account preferences and application settings.
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-lg max-w-4xl">
        {/* Profile Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-lg"
        >
          <h2 className="font-display text-title-lg font-bold text-on-surface mb-lg">Profile Settings</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none"
                style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none"
                style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                placeholder="your@email.com"
              />
            </div>
            <button 
              onClick={handleSaveProfile}
              disabled={saving}
              className="bg-indigo-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-indigo-700 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </motion.div>

        {/* Notification Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl p-lg"
        >
          <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Notifications</h2>
          <div className="space-y-6">
            {[
              { label: "Email Notifications", description: "Receive updates via email", enabled: emailNotifs, type: "email_notifications" },
              { label: "WhatsApp Alerts", description: "Get approval requests on WhatsApp", enabled: whatsappNotifs, type: "whatsapp_notifications" },
              { label: "Push Notifications", description: "Browser notifications", enabled: pushNotifs, type: "push_notifications" },
            ].map((setting, index) => (
              <div key={index} className="flex items-center justify-between">
                <div>
                  <p className="text-base" style={{ color: "var(--text-primary)" }}>{setting.label}</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{setting.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={setting.enabled} 
                    onChange={(e) => {
                      if (setting.type === "email_notifications") setEmailNotifs(e.target.checked);
                      if (setting.type === "whatsapp_notifications") setWhatsappNotifs(e.target.checked);
                      if (setting.type === "push_notifications") setPushNotifs(e.target.checked);
                      handleToggleNotification(setting.type, e.target.checked);
                    }}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 dark:bg-gray-700"></div>
                </label>
              </div>
            ))}
          </div>
        </motion.div>

        {/* AI Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl p-lg"
        >
          <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>AI Configuration</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>Default Tone</label>
              <select 
                value={defaultTone}
                onChange={(e) => setDefaultTone(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 focus:outline-none" 
                style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              >
                <option>Professional</option>
                <option>Casual</option>
                <option>Humorous</option>
                <option>Inspirational</option>
              </select>
            </div>
            <div>
              <label className="font-label-md text-label-md text-on-surface-variant block mb-xs">Creativity Level: {creativityLevel}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={creativityLevel}
                onChange={(e) => setCreativityLevel(Number(e.target.value))}
                onBlur={handleSaveAISettings}
                className="w-full h-2 bg-surface-container-high rounded-full appearance-none cursor-pointer"
              />
            </div>
          </div>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-xl p-lg border-error/30"
        >
          <h2 className="font-display text-title-lg font-bold text-error mb-lg">Danger Zone</h2>
          <div className="space-y-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body-md text-body-md text-on-surface">Delete Account</p>
                <p className="font-label-md text-label-md text-on-surface-variant text-xs">Permanently delete your account and all data</p>
              </div>
              <button 
                onClick={handleDeleteAccount}
                className="bg-error-container text-error rounded-lg px-md py-sm font-label-md text-label-md font-bold hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
