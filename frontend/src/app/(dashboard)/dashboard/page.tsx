"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Calendar,
  TrendingUp,
  Sparkles,
  ArrowUpRight,
  Plug,
  PenLine,
  Rocket,
  Lightbulb,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { listContent } from "@/services/content";
import { listScheduled } from "@/services/scheduling";
import { getStoredUser } from "@/lib/auth";
import type { Content, ScheduledPost } from "@/types";
import { formatDateTime, capitalize } from "@/lib/utils";

interface StatCardData {
  label: string;
  description: string;
  value: number;
  icon: React.ElementType;
  borderColor: string;
  iconBg: string;
  iconText: string;
  cta: { label: string; href: string };
}

const ONBOARDING_KEY = "socialium_onboarding_dismissed";

export default function DashboardPage() {
  const [recentContent, setRecentContent] = useState<Content[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(ONBOARDING_KEY) !== "true";
    }
    return true;
  });
  const user = getStoredUser();
  const firstName = user?.full_name?.split(" ")[0] || user?.username || null;

  useEffect(() => {
    async function load() {
      try {
        const [content, scheduled] = await Promise.all([
          listContent(),
          listScheduled(),
        ]);
        setRecentContent(content.slice(0, 5));
        setScheduledPosts(scheduled.slice(0, 5));
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalContent = recentContent.length;
  const totalScheduled = scheduledPosts.length;
  const totalPublished = recentContent.filter((c) => c.status === "published").length;
  const totalAI = recentContent.filter((c) => c.source_type === "ai_generated").length;
  const isNewUser = totalContent === 0 && totalScheduled === 0;

  const stats: StatCardData[] = [
    {
      label: "Total Content",
      description: "Posts created this month",
      value: totalContent,
      icon: FileText,
      borderColor: "border-l-blue-500",
      iconBg: "bg-blue-50",
      iconText: "text-blue-600",
      cta: { label: "Create post", href: "/content" },
    },
    {
      label: "Scheduled",
      description: "Posts queued for publishing",
      value: totalScheduled,
      icon: Calendar,
      borderColor: "border-l-purple-500",
      iconBg: "bg-purple-50",
      iconText: "text-purple-600",
      cta: { label: "Schedule post", href: "/scheduling" },
    },
    {
      label: "Published",
      description: "Posts published this month",
      value: totalPublished,
      icon: TrendingUp,
      borderColor: "border-l-green-500",
      iconBg: "bg-green-50",
      iconText: "text-green-600",
      cta: { label: "View analytics", href: "/analytics" },
    },
    {
      label: "AI Generated",
      description: "Posts created with AI assist",
      value: totalAI,
      icon: Sparkles,
      borderColor: "border-l-orange-500",
      iconBg: "bg-orange-50",
      iconText: "text-orange-600",
      cta: { label: "Generate content", href: "/content" },
    },
  ];

  // Onboarding checklist state
  const onboardingSteps = [
    { label: "Connect a social platform", done: false, href: "/platforms", cta: "Connect" },
    { label: "Generate your first post", done: totalContent > 0, href: "/content", cta: "Create" },
    { label: "Schedule and publish", done: totalScheduled > 0, href: "/scheduling", cta: "Schedule" },
  ];
  const allStepsDone = onboardingSteps.every((s) => s.done);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {firstName ? `Welcome back, ${firstName}! Here's your overview.` : "Welcome back! Here's your overview."}
        </p>
      </div>

      {/* Onboarding Banner — shown for new users */}
      {isNewUser && showOnboarding && !allStepsDone && (
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Rocket className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Welcome to Socialium! Get started in 3 steps</h2>
                <p className="text-sm text-gray-600 mt-0.5">Complete these steps to start managing your social media like a pro.</p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowOnboarding(false);
                localStorage.setItem(ONBOARDING_KEY, "true");
              }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-white/60"
            >
              Skip
            </button>
          </div>
          <div className="mt-5 space-y-3">
            {onboardingSteps.map((step, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-white/70 px-4 py-3">
                <div className="flex items-center gap-3">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300" />
                  )}
                  <span className={`text-sm font-medium ${step.done ? "text-gray-400 line-through" : "text-gray-700"}`}>
                    {i + 1}. {step.label}
                  </span>
                </div>
                {!step.done && (
                  <Link
                    href={step.href}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    {step.cta} &rarr;
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border border-gray-200 border-l-4 ${stat.borderColor} bg-white p-5 transition-all duration-200 hover:shadow-md hover:scale-105`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
              <div className={`rounded-lg p-2 ${stat.iconBg}`}>
                <stat.icon className={`h-4 w-4 ${stat.iconText}`} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{stat.value}</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {stat.value === 0 ? "No data yet" : stat.description}
              </p>
              <Link
                href={stat.cta.href}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {stat.cta.label} &rarr;
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions — always visible */}
      {isNewUser && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            href="/content"
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-blue-300 hover:shadow-md group"
          >
            <div className="rounded-lg bg-blue-50 p-3 group-hover:bg-blue-100 transition-colors">
              <PenLine className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Create your first post</p>
              <p className="text-xs text-gray-500">Write or generate AI content</p>
            </div>
          </Link>
          <Link
            href="/platforms"
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-purple-300 hover:shadow-md group"
          >
            <div className="rounded-lg bg-purple-50 p-3 group-hover:bg-purple-100 transition-colors">
              <Plug className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Connect a platform</p>
              <p className="text-xs text-gray-500">Link LinkedIn, Twitter, or Instagram</p>
            </div>
          </Link>
          <Link
            href="/scheduling"
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-green-300 hover:shadow-md group"
          >
            <div className="rounded-lg bg-green-50 p-3 group-hover:bg-green-100 transition-colors">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Schedule content</p>
              <p className="text-xs text-gray-500">Plan posts for optimal times</p>
            </div>
          </Link>
        </div>
      )}

      {/* Content Lists */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Content */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Recent Content</h2>
            <Link href="/content" className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentContent.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <FileText className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No content yet</p>
                <Link href="/content" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">
                  Create your first post &rarr;
                </Link>
              </div>
            ) : (
              recentContent.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.title || "Untitled"}</p>
                    <p className="text-xs text-gray-500">{item.platform ? capitalize(item.platform) : "No platform"}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.status === "published" ? "bg-green-100 text-green-700" :
                    item.status === "scheduled" ? "bg-purple-100 text-purple-700" :
                    item.status === "draft" ? "bg-gray-100 text-gray-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>
                    {capitalize(item.status.replace("_", " "))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Scheduled */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Upcoming Scheduled</h2>
            <Link href="/scheduling" className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {scheduledPosts.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Calendar className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No scheduled posts</p>
                <Link href="/scheduling" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">
                  Schedule your first post &rarr;
                </Link>
              </div>
            ) : (
              scheduledPosts.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.title || "Untitled"}</p>
                    <p className="text-xs text-gray-500">{item.platform ? capitalize(item.platform) : "\u2014"}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {item.scheduled_at ? formatDateTime(item.scheduled_at) : "\u2014"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Tips Card */}
      {isNewUser && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Pro tip</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Posts scheduled on Tuesday and Thursday mornings get up to 30% more engagement. Use AI generation to create variations and A/B test your best-performing content.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
