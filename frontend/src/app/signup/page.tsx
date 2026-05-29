"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { signUp } from "@/services/auth";
import { setTokens, setStoredUser } from "@/lib/auth";
import { clearWorkspace } from "@/lib/workspace";
import toast from "react-hot-toast";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      console.log('Attempting signup with:', email, username);
      const res = await signUp({ email, password, username, full_name: fullName || undefined });
      console.log('Signup successful:', res);
      
      console.log('Saving tokens...');
      console.log('Access token type:', typeof res.access_token);
      console.log('Access token length:', res.access_token?.length);
      
      setTokens(res.access_token, res.refresh_token);
      
      // Verify tokens were saved
      const savedToken = localStorage.getItem('access_token');
      console.log('Token saved to localStorage:', !!savedToken);
      console.log('Saved token matches:', savedToken === res.access_token);
      
      if (res.user) {
        setStoredUser(res.user);
        console.log('User saved:', res.user.email);
      }
      
      clearWorkspace(); // Clear stale workspace ID
      
      toast.success("Account created! Welcome to Socialium!");
      console.log('Redirecting to dashboard...');
      
      // Small delay to ensure localStorage is committed
      await new Promise(resolve => setTimeout(resolve, 200));
      
      router.push("/dashboard");
    } catch (err: any) {
      console.error('Signup error:', err);
      console.error('Error response:', err?.response);
      console.error('Error data:', err?.response?.data);
      console.error('Error status:', err?.response?.status);
      const errorMessage = err?.response?.data?.detail || err?.message || "Signup failed. Please try again.";
      console.error('Showing error:', errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-brand-600" />
            <span className="text-2xl font-bold text-gray-900">Socialium</span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Create your account to get started
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="johndoe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="Min 8 characters"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
