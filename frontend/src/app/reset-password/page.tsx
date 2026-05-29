"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, KeyRound, Eye, EyeOff } from "lucide-react";
import { setTokens, isAuthenticated } from "@/lib/auth";
import api from "@/lib/api";
import toast from "react-hot-toast";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTokenLoaded, setIsTokenLoaded] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Extract tokens from URL hash or query parameters
    let accessToken = null;
    let refreshToken = null;

    // 1. Try URL hash parameters (Supabase default recovery redirect)
    if (typeof window !== "undefined" && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      accessToken = hashParams.get("access_token");
      refreshToken = hashParams.get("refresh_token");
    }

    // 2. Try search/query parameters as a fallback
    if (typeof window !== "undefined" && !accessToken) {
      const searchParams = new URLSearchParams(window.location.search);
      accessToken = searchParams.get("access_token");
      refreshToken = searchParams.get("refresh_token");
    }

    if (accessToken && refreshToken) {
      setTokens(accessToken, refreshToken);
      setIsTokenLoaded(true);
      // Clean up URL to hide tokens from history/address bar
      if (typeof window !== "undefined") {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else {
      // If no token in URL, check if the session is already authenticated
      if (isAuthenticated()) {
        setIsTokenLoaded(true);
      } else {
        setError("Invalid or expired password reset link. Redirecting you to login...");
        const timer = setTimeout(() => {
          router.push("/login");
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      // Use the standard Axios api client which automatically attaches the access_token we set in useEffect
      const response = await api.put("/auth/reset-password", {
        password: newPassword,
      });

      if (response.status === 200 || response.data?.status === "success") {
        toast.success("Password updated successfully!");
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      } else {
        toast.error("Failed to update password. Please request a new recovery link.");
      }
    } catch (err: any) {
      console.error("Password update error:", err);
      const errMsg = err.response?.data?.detail || "Failed to update password. Please try again.";
      toast.error(errMsg);
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-brand-600" />
            <span className="text-2xl font-bold text-gray-900">Socialium</span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Securely reset your password
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800 shadow-sm">
            <p className="font-semibold">{error}</p>
          </div>
        ) : !isTokenLoaded ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="flex justify-center mb-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent"></div>
            </div>
            <p className="text-sm text-gray-600">Authenticating reset session...</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
          >
            <div className="mb-6 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <KeyRound className="h-6 w-6" />
              </div>
            </div>

            <h3 className="text-center text-lg font-bold text-gray-900 mb-6">
              Create New Password
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 pl-4 pr-10 py-2.5 text-sm text-black outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  placeholder="Repeat your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? "Updating password..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
