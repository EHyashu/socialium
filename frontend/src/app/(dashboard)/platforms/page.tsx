"use client";

import { useEffect, useState, Suspense } from "react";
import { Plug, ExternalLink, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { listPlatformAccounts, disconnectPlatform, getOAuthUrl, handleOAuthCallback } from "@/services/platforms";
import { getStoredUser } from "@/lib/auth";
import type { PlatformAccount, Platform } from "@/types";
import { capitalize, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

const PLATFORMS: { id: Platform; label: string; color: string }[] = [
  { id: "linkedin", label: "LinkedIn", color: "bg-blue-600" },
  { id: "twitter", label: "Twitter / X", color: "bg-black" },
  { id: "instagram", label: "Instagram", color: "bg-gradient-to-r from-purple-500 to-pink-500" },
  { id: "facebook", label: "Facebook", color: "bg-blue-700" },
];

function PlatformsContent() {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    async function load() {
      // Check for OAuth callback parameters
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const linkedinSuccess = searchParams.get("linkedin");
      const error = searchParams.get("error");

      // Check for OAuth error
      if (error) {
        toast.error(`OAuth error: ${error}`);
        window.history.replaceState({}, "", "/platforms");
        return;
      }

      // Check if backend already handled the OAuth (redirect with linkedin=success)
      if (linkedinSuccess === "success") {
        toast.success("LinkedIn connected successfully!");
        window.history.replaceState({}, "", "/platforms");
      }
      // Otherwise, try to handle OAuth callback (for platforms that use POST)
      else if (code && state) {
        try {
          toast.loading("Connecting account...", { id: "oauth" });
          await handleOAuthCallback("linkedin", code, state);
          toast.success("LinkedIn connected!", { id: "oauth" });
          window.history.replaceState({}, "", "/platforms");
        } catch (err: any) {
          const errorMsg = err?.response?.data?.detail || "Failed to connect LinkedIn";
          toast.error(errorMsg, { id: "oauth" });
          console.error("OAuth callback error:", err);
        }
      }

      try {
        const data = await listPlatformAccounts();
        setAccounts(data);
      } catch {
        // Platforms may not be connected yet
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [searchParams]);

  const handleConnect = async (platform: Platform) => {
    try {
      const user = getStoredUser();
      if (!user?.id) {
        toast.error("User not authenticated");
        return;
      }
      const url = await getOAuthUrl(platform, user.id);
      window.location.href = url;
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || `Failed to start ${platform} connection`;
      toast.error(errorMsg);
      console.error(`OAuth start error:`, err);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm("Disconnect this platform?")) return;
    try {
      await disconnectPlatform(accountId);
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      toast.success("Platform disconnected");
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  const isConnected = (platform: Platform) =>
    accounts.some((a) => a.platform === platform && a.is_active);

  const getAccount = (platform: Platform) =>
    accounts.find((a) => a.platform === platform && a.is_active);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platforms</h1>
        <p className="text-sm text-gray-500 mt-1">Connect your social media accounts</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PLATFORMS.map((platform) => {
          const connected = isConnected(platform.id);
          const account = getAccount(platform.id);

          return (
            <div
              key={platform.id}
              className="rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${platform.color} flex items-center justify-center`}>
                    <Plug className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{platform.label}</p>
                    {connected && account && (
                      <p className="text-xs text-gray-500">
                        @{account.platform_username || account.platform_user_id}
                      </p>
                    )}
                  </div>
                </div>

                {connected ? (
                  <button
                    onClick={() => account && handleDisconnect(account.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(platform.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Connect
                  </button>
                )}
              </div>

              {connected && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-xs text-green-600">Connected</span>
                  {account?.connected_at && (
                    <span className="text-xs text-gray-400 ml-auto">
                      Since {formatDate(account.connected_at)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function NewPlatformsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20">Loading...</div>}>
      <PlatformsContent />
    </Suspense>
  );
}
