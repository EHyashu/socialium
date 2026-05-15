"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Bell, Moon, Sun, ChevronDown, User, Settings, Zap, LogOut } from "lucide-react";
import { getStoredUser, logout } from "@/lib/auth";

export default function Header() {
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Read user + dark mode from localStorage after hydration to avoid mismatch
  useEffect(() => {
    setUser(getStoredUser());
    const stored = localStorage.getItem("socialium_dark_mode") === "true";
    setDarkMode(stored);
    if (stored) {
      document.documentElement.classList.add("dark");
    }
    setMounted(true);
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("socialium_dark_mode", String(next));
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end border-b border-gray-200 bg-white px-6">
      {/* Right side — all controls */}
      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          title="Toggle dark mode"
        >
          {mounted && darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Notification bell — no fake badge */}
        <Link
          href="/notifications"
          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <Bell className="h-5 w-5" />
        </Link>

        {/* Create New Post CTA */}
        <Link
          href="/content"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create New Post
        </Link>

        {/* User Menu */}
        <div className="relative ml-2">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100"
          >
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-semibold text-blue-700">
                {user?.username?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-900 leading-tight">
                {user?.full_name || user?.username || "User"}
              </p>
              <p className="text-[11px] text-gray-500">{user?.subscription_tier || "free"} plan</p>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400 hidden sm:block" />
          </button>

          {/* Dropdown */}
          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-2 shadow-lg">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{user?.email || "user@example.com"}</p>
                  <p className="text-xs text-gray-500 mt-0.5 capitalize">{user?.subscription_tier || "free"} plan</p>
                </div>
                <div className="py-1">
                  <Link
                    href="/settings/billing"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <User className="h-4 w-4 text-gray-400" />
                    Profile Settings
                  </Link>
                  <Link
                    href="/settings/billing"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Settings className="h-4 w-4 text-gray-400" />
                    Workspace Settings
                  </Link>
                  <Link
                    href="/settings/billing"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50"
                  >
                    <Zap className="h-4 w-4" />
                    Upgrade to Pro
                  </Link>
                </div>
                <div className="border-t border-gray-100 py-1">
                  <button
                    onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
