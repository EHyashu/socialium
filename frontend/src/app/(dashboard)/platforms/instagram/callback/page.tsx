"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { handleOAuthCallback } from "@/services/platforms";
import toast from "react-hot-toast";

function InstagramCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    async function process() {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      if (!code || !state) {
        setStatus("error");
        return;
      }
      try {
        await handleOAuthCallback("instagram", code, state);
        setStatus("success");
        toast.success("Instagram connected!");
        setTimeout(() => router.push("/platforms"), 2000);
      } catch {
        setStatus("error");
        toast.error("Failed to connect Instagram");
      }
    }
    process();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        {status === "loading" && (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
            <p className="mt-4 text-gray-600">Connecting Instagram...</p>
          </>
        )}
        {status === "success" && (
          <p className="text-green-600 font-medium">Instagram connected! Redirecting...</p>
        )}
        {status === "error" && (
          <>
            <p className="text-red-600 font-medium">Connection failed</p>
            <a href="/platforms" className="mt-2 text-sm text-brand-600 hover:underline">
              Back to Platforms
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function InstagramCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" /></div>}>
      <InstagramCallbackContent />
    </Suspense>
  );
}
