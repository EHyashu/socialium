"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { requireWorkspaceId, fetchAndStoreWorkspace } from "@/lib/workspace";
import { getAnalyticsOverview } from "@/services/analytics";
import toast from "react-hot-toast";

interface PlatformData {
  platform: string;
  posts: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}

export default function NewAnalyticsPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setMounted(true);
    const id = requireWorkspaceId();
    if (!id) {
      fetchAndStoreWorkspace().then(fetched => {
        if (fetched) setWorkspaceId(fetched);
      });
    } else {
      setWorkspaceId(id);
    }
  }, []);

  useEffect(() => {
    if (!workspaceId || !mounted) return;
    
    setLoading(true);
    getAnalyticsOverview(workspaceId, days)
      .then((data) => setAnalytics(data))
      .catch((err) => {
        console.error("Failed to load analytics:", err);
        toast.error("Failed to load analytics");
      })
      .finally(() => setLoading(false));
  }, [workspaceId, days, mounted]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <span className="material-symbols-outlined text-4xl animate-spin" style={{ color: "#6366f1" }}>progress_activity</span>
      </div>
    );
  }

  // Platform icon mapping
  const getPlatformIcon = (platform: string): string => {
    const icons: Record<string, string> = {
      linkedin: "business_center",
      twitter: "tag",
      instagram: "photo_camera",
      facebook: "group",
      whatsapp: "chat",
    };
    return icons[platform.toLowerCase()] || "public";
  };

  // Platform color mapping
  const getPlatformColor = (platform: string): string => {
    const colors: Record<string, string> = {
      linkedin: "#0A66C2",
      twitter: "#1DA1F2",
      instagram: "#E4405F",
      facebook: "#1877F2",
      whatsapp: "#25D366",
    };
    return colors[platform.toLowerCase()] || "#6366f1";
  };

  const platformBreakdown: PlatformData[] = analytics?.platform_breakdown || [];
  const topPosts = analytics?.top_posts || [];

  const stats = [
    {
      icon: "post_add",
      label: "Total Posts",
      value: analytics?.summary?.total_posts || 0,
      change: null,  // Remove hardcoded percentage
      trend: null,
      color: "text-primary",
    },
    {
      icon: "favorite",
      label: "Total Engagement",
      value: (analytics?.summary?.total_likes || 0) + 
             (analytics?.summary?.total_comments || 0) + 
             (analytics?.summary?.total_shares || 0),
      change: null,  // Remove hardcoded percentage
      trend: null,
      color: "text-secondary",
    },
    {
      icon: "visibility",
      label: "Impressions",
      value: analytics?.summary?.total_impressions || 0,
      change: null,  // Remove hardcoded percentage
      trend: null,
      color: "text-tertiary",
    },
    {
      icon: "trending_up",
      label: "Avg Engagement Rate",
      value: `${analytics?.summary?.average_engagement_rate || 0}%`,
      change: null,  // Remove hardcoded percentage
      trend: null,
      color: "text-primary",
    },
  ];

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--bg-primary)" }}>
      {/* Header & Controls */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Analytics Overview</h1>
          <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
            {platformBreakdown.length > 0 
              ? `Tracking performance across ${platformBreakdown.length} connected platform${platformBreakdown.length > 1 ? 's' : ''}.`
              : 'Connect platforms to start tracking your analytics.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-md">
          <div className="flex rounded-lg p-1 border" style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)" }}>
            <button
              onClick={() => setDays(7)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                days === 7 ? "bg-surface-container-highest text-primary shadow-sm" : "hover:text-on-surface"
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setDays(30)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                days === 30 ? "bg-surface-container-highest text-primary shadow-sm" : "hover:text-on-surface"
              }`}
            >
              30D
            </button>
            <button
              onClick={() => setDays(90)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                days === 90 ? "bg-surface-container-highest text-primary shadow-sm" : "hover:text-on-surface"
              }`}
            >
              90D
            </button>
            <button
              onClick={() => setDays(365)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                days === 365 ? "bg-surface-container-highest text-primary shadow-sm" : "hover:text-on-surface"
              }`}
            >
              1Y
            </button>
          </div>
        </div>
      </section>

      {/* Empty State */}
      {platformBreakdown.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-12 text-center mb-8"
        >
          <span className="material-symbols-outlined text-6xl text-on-surface-variant mb-4">analytics</span>
          <h3 className="text-2xl font-bold text-on-surface mb-2">No Analytics Data Yet</h3>
          <p className="text-on-surface-variant mb-6 max-w-md mx-auto">
            Connect your social media platforms and publish content to start tracking your performance metrics.
          </p>
          <a
            href="/platforms"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-medium hover:opacity-90 transition-all"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Connect Platforms
          </a>
        </motion.div>
      )}

      {/* Stats Grid */}
      {platformBreakdown.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md mb-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-card rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`material-symbols-outlined ${stat.color} text-[28px]`}>{stat.icon}</span>
                  {stat.change && stat.trend && (
                    <span className={`text-sm font-medium flex items-center gap-1 ${
                      stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.change}
                      <span className="material-symbols-outlined text-[16px]">
                        {stat.trend === 'up' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold text-on-surface">{stat.value}</p>
                <p className="text-sm text-on-surface-variant mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Platform Breakdown - REAL DATA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card rounded-xl p-6"
            >
              <h2 className="text-xl font-bold text-on-surface mb-6">Platform Performance</h2>
              <div className="space-y-4">
                {platformBreakdown.map((platform, index) => (
                  <motion.div
                    key={platform.platform}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-4 p-4 rounded-lg hover:bg-surface-container transition-colors"
                  >
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${getPlatformColor(platform.platform)}20` }}
                    >
                      <span 
                        className="material-symbols-outlined text-[20px]"
                        style={{ color: getPlatformColor(platform.platform) }}
                      >
                        {getPlatformIcon(platform.platform)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-on-surface capitalize">
                          {platform.platform}
                        </span>
                        <span className="text-sm font-medium text-on-surface-variant">
                          {platform.posts} posts
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">favorite</span>
                          {platform.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
                          {platform.comments}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">share</span>
                          {platform.shares}
                        </span>
                        <span className="ml-auto font-medium" style={{ color: getPlatformColor(platform.platform) }}>
                          {platform.engagement_rate}% engagement
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Top Performing Posts */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card rounded-xl p-6"
            >
              <h2 className="text-xl font-bold text-on-surface mb-6">Top Performing Posts</h2>
              {topPosts.length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">post_add</span>
                  <p className="text-on-surface-variant">No posts published yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {topPosts.slice(0, 5).map((post: any, index: number) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-4 p-4 rounded-lg hover:bg-surface-container transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-on-surface truncate">{post.title || "Untitled Post"}</p>
                        <p className="text-xs text-on-surface-variant capitalize">{post.platform}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-on-surface">
                          {(post.likes || 0) + (post.comments || 0) + (post.shares || 0)}
                        </p>
                        <p className="text-xs text-on-surface-variant">engagements</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* AI Insights - Data-Driven */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
              <h2 className="text-xl font-bold text-on-surface">AI Insights</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Best Platform */}
              <div className="p-4 rounded-lg bg-surface-container">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Best Performing Platform</p>
                <p className="text-2xl font-bold text-on-surface capitalize mb-1">
                  {platformBreakdown.length > 0 
                    ? platformBreakdown.reduce((prev: PlatformData, current: PlatformData) => 
                        (current.engagement_rate > prev.engagement_rate) ? current : prev
                      ).platform
                    : "N/A"}
                </p>
                <p className="text-sm text-on-surface-variant">
                  {platformBreakdown.length > 0 
                    ? `${platformBreakdown.reduce((prev: PlatformData, current: PlatformData) => 
                        (current.engagement_rate > prev.engagement_rate) ? current : prev
                      ).engagement_rate}% avg engagement rate`
                    : "Connect platforms to see insights"}
                </p>
              </div>

              {/* Content Recommendation */}
              <div className="p-4 rounded-lg bg-surface-container">
                <p className="text-xs font-bold uppercase tracking-wider text-tertiary mb-2">Content Recommendation</p>
                <p className="text-base font-medium text-on-surface mb-1">
                  {analytics?.summary?.total_posts === 0 
                    ? "Start by publishing your first post"
                    : platformBreakdown.length === 1
                    ? "Connect more platforms to expand your reach"
                    : "Focus on your top platform for maximum engagement"}
                </p>
                <p className="text-sm text-on-surface-variant">
                  {analytics?.summary?.total_posts || 0} posts published so far
                </p>
              </div>

              {/* Growth Tip */}
              <div className="p-4 rounded-lg bg-surface-container">
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#8b5cf6" }}>Growth Opportunity</p>
                <p className="text-base font-medium text-on-surface mb-1">
                  {platformBreakdown.length < 2 
                    ? "Connect 2+ platforms to compare performance"
                    : "Your multi-platform strategy is working well"}
                </p>
                <p className="text-sm text-on-surface-variant">
                  {platformBreakdown.length} of 5 platforms connected
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
