"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setTokens, setStoredUser } from "@/lib/auth";
import toast from "react-hot-toast";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const codeVerifier = localStorage.getItem("google_code_verifier");

      if (!code || !codeVerifier) {
        toast.error("Authentication failed: Missing code or verifier");
        router.push("/login");
        return;
      }

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, code_verifier: codeVerifier }),
        });

        if (response.ok) {
          const data = await response.json();
          setTokens(data.access_token, data.refresh_token);
          if (data.user) {
            setStoredUser(data.user);
          }
          localStorage.removeItem("google_code_verifier");
          toast.success("Login successful!");
          router.push("/dashboard");
        } else {
          const error = await response.json();
          toast.error(error.detail || "Google authentication failed");
          router.push("/login");
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        toast.error("Authentication failed");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand-600 border-r-transparent"></div>
        <p className="mt-4 text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading sign in...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
