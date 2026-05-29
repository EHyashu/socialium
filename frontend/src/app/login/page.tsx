"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Mail, Phone } from "lucide-react";
import { signIn } from "@/services/auth";
import { setTokens, setStoredUser, isAuthenticated } from "@/lib/auth";
import { clearWorkspace } from "@/lib/workspace";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  
  // Phone OTP states
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      console.log('Attempting login with:', email);
      const res = await signIn({ email, password });
      console.log('Login successful:', res);
      
      console.log('Saving tokens...');
      setTokens(res.access_token, res.refresh_token);
      
      // Verify tokens were saved
      const savedToken = localStorage.getItem('access_token');
      console.log('Token saved to localStorage:', !!savedToken);
      
      if (res.user) {
        setStoredUser(res.user);
        console.log('User saved:', res.user.email);
      }
      
      clearWorkspace(); // Clear stale workspace ID
      
      toast.success("Welcome back!");
      console.log('Redirecting to dashboard...');
      
      // Small delay to ensure localStorage is committed
      await new Promise(resolve => setTimeout(resolve, 200));
      
      router.push("/dashboard");
    } catch (err: any) {
      console.error('Login error:', err);
      
      // Better error messages
      let errorMessage = "Login failed. Please try again.";
      
      if (err.response?.status === 401) {
        errorMessage = "Invalid email or password. Please check your credentials or create a new account.";
      } else if (err.response?.status === 500) {
        errorMessage = "Server error. Please try again later.";
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = "Cannot connect to server. Please check your internet connection.";
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Please enter your phone number");
      return;
    }

    setSendingOTP(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/phone/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });

      if (response.ok) {
        setOtpSent(true);
        toast.success("OTP sent! Check your phone");
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to send OTP");
      }
    } catch (error) {
      toast.error("Failed to send OTP");
    } finally {
      setSendingOTP(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      toast.error("Please enter the OTP");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/phone/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneNumber, otp }),
      });

      if (response.ok) {
        const data = await response.json();
        setTokens(data.access_token, data.refresh_token);
        if (data.user) {
          setStoredUser(data.user);
        }
        toast.success("Login successful!");
        router.push("/dashboard");
      } else {
        const error = await response.json();
        toast.error(error.detail || "Invalid OTP");
      }
    } catch (error) {
      toast.error("Failed to verify OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        toast.success("Password recovery email sent! Check your inbox.");
        setForgotPasswordMode(false);
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to send recovery email");
      }
    } catch (error) {
      toast.error("Failed to send recovery email");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // For Google OAuth, we need to redirect to Supabase's OAuth endpoint
    // This requires setting up Google OAuth provider in Supabase dashboard
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      toast.error("Supabase URL not configured");
      return;
    }

    // PKCE flow for Google OAuth
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    // Store code verifier for later exchange
    localStorage.setItem('google_code_verifier', codeVerifier);
    
    // Redirect to Supabase Google OAuth
    window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${window.location.origin}/auth/callback&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  };

  const generateCodeVerifier = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const generateCodeChallenge = async (codeVerifier: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
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
            Sign in to manage your social media
          </p>
        </div>

        {!forgotPasswordMode ? (
          <>
            {/* Login Method Tabs */}
            <div className="mb-6 flex gap-2 rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setLoginMethod("email")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
                  loginMethod === "email"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Mail className="h-4 w-4" />
                Email
              </button>
              <button
                onClick={() => setLoginMethod("phone")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
                  loginMethod === "phone"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Phone className="h-4 w-4" />
                Phone
              </button>
            </div>

            {/* Google Login Button */}
            <button
              onClick={handleGoogleLogin}
              className="w-full mb-4 flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="mb-4 flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-300"></div>
              <span className="text-xs text-gray-500">OR</span>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div>

            {/* Email Login Form */}
            {loginMethod === "email" && (
              <form
                onSubmit={handleSubmit}
                className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setForgotPasswordMode(true)}
                        className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>

                <p className="mt-4 text-center text-sm text-gray-600">
                  Don&apos;t have an account?{" "}
                  <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
                    Sign up
                  </Link>
                </p>
              </form>
            )}

            {/* Phone OTP Login Form */}
            {loginMethod === "phone" && (
              <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
                {!otpSent ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        placeholder="+1234567890"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Enter your phone number with country code (e.g., +1 for US)
                      </p>
                    </div>

                    <button
                      onClick={handleSendOTP}
                      disabled={sendingOTP}
                      className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                    >
                      {sendingOTP ? "Sending..." : "Send OTP"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Enter OTP
                      </label>
                      <input
                        type="text"
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        placeholder="123456"
                        maxLength={6}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        We sent a 6-digit code to {phoneNumber}
                      </p>
                    </div>

                    <button
                      onClick={handleVerifyOTP}
                      disabled={loading}
                      className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                    >
                      {loading ? "Verifying..." : "Verify & Login"}
                    </button>

                    <button
                      onClick={() => {
                        setOtpSent(false);
                        setOtp("");
                      }}
                      className="w-full rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Change Phone Number
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Forgot Password Form */
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Reset Password</h3>
            <p className="text-sm text-gray-600 mb-6">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  placeholder="you@example.com"
                />
              </div>

              <button
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>

              <button
                type="button"
                onClick={() => setForgotPasswordMode(false)}
                className="w-full text-center text-sm font-medium text-gray-600 hover:text-gray-950 mt-2"
              >
                Back to Login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
