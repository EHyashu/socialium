"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Hash, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { requireWorkspaceId, fetchAndStoreWorkspace } from "@/lib/workspace";
import api from "@/lib/api";

interface Trend {
  id: string;
  keyword: string;
  platform: string;
  volume_score: number;
  change_7d: number;
  created_at: string;
}

export default function TrendsPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [mounted, setMounted] = useState(false);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndustry, setSelectedIndustry] = useState("technology");
  const [timeRange, setTimeRange] = useState(7);

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
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [trendsRes, keywordsRes] = await Promise.all([
        api.get("/trends"),
        api.get(`/trends/keywords?industry=${selectedIndustry}&count=15`),
      ]);

      setTrends(trendsRes.data.trends || []);
      setKeywords(keywordsRes.data.keywords || []);
    } catch (error) {
      console.error("Failed to load trends:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <span className="material-symbols-outlined text-4xl animate-spin" style={{ color: "#6366f1" }}>progress_activity</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          Trending Topics <TrendingUp className="inline-block ml-2 h-8 w-8" />
        </h1>
        <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
          Discover trending topics and keywords to boost your content reach
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Industry</label>
          <select
            value={selectedIndustry}
            onChange={(e) => {
              setSelectedIndustry(e.target.value);
              loadData();
            }}
            className="rounded-lg border px-4 py-2"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
          >
            <option value="technology">Technology</option>
            <option value="marketing">Marketing</option>
            <option value="business">Business</option>
            <option value="lifestyle">Lifestyle</option>
            <option value="finance">Finance</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Time Range</label>
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setTimeRange(days)}
                className={`px-4 py-2 text-sm font-medium ${
                  timeRange === days ? "bg-indigo-600 text-white" : ""
                }`}
                style={{
                  background: timeRange === days ? undefined : "var(--bg-card)",
                  color: timeRange === days ? undefined : "var(--text-primary)"
                }}
              >
                {days}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border p-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <Hash className="h-6 w-6 text-indigo-500" />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Tracked</span>
          </div>
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{trends.length}</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Active Trends</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border p-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <ArrowUpRight className="h-6 w-6 text-emerald-500" />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Rising</span>
          </div>
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            {trends.filter(t => t.change_7d > 20).length}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Trending Up</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border p-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <BarChart3 className="h-6 w-6 text-purple-500" />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Avg Volume</span>
          </div>
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            {trends.length > 0 ? Math.round(trends.reduce((sum, t) => sum + t.volume_score, 0) / trends.length) : 0}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Score</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trending Keywords */}
        <div className="rounded-xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            Trending Keywords
          </h2>

          {keywords.length === 0 ? (
            <div className="text-center py-12">
              <Hash className="h-16 w-16 mx-auto mb-4 opacity-20" style={{ color: "var(--text-secondary)" }} />
              <p style={{ color: "var(--text-secondary)" }}>No keywords found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keywords.map((keyword, index) => (
                <div
                  key={keyword}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)" }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>#{index + 1}</span>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{keyword}</span>
                  </div>
                  <button className="text-xs px-3 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                    Use in Content
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Trends */}
        <div className="rounded-xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            Active Trends
          </h2>

          {trends.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-20" style={{ color: "var(--text-secondary)" }} />
              <p style={{ color: "var(--text-secondary)" }}>No active trends</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trends.map((trend) => (
                <div
                  key={trend.id}
                  className="p-4 rounded-lg border"
                  style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)" }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{trend.keyword}</h3>
                      <span className="text-xs px-2 py-1 rounded" style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}>
                        {trend.platform}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        {trend.change_7d > 0 ? (
                          <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`text-sm font-bold ${
                          trend.change_7d > 0 ? "text-emerald-500" : "text-red-500"
                        }`}>
                          {trend.change_7d > 0 ? "+" : ""}{trend.change_7d}%
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        Volume: {Math.round(trend.volume_score * 100)}
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full" style={{ background: "var(--bg-card)" }}>
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${trend.volume_score * 100}%`,
                        background: trend.volume_score > 0.7 ? "#10b981" : trend.volume_score > 0.4 ? "#3b82f6" : "#f59e0b"
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trend Insights */}
      <div className="mt-6 rounded-xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          💡 AI Insights
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: "Content Opportunity",
              description: `"${keywords[0] || 'AI'}" is trending. Create content around this topic for maximum reach.`,
              color: "#10b981"
            },
            {
              title: "Best Time to Post",
              description: "Your audience is most active on Tuesday at 2 PM. Schedule trend-based content then.",
              color: "#3b82f6"
            },
            {
              title: "Engagement Tip",
              description: "Posts with trending hashtags get 3x more engagement. Add 2-3 relevant trends to your posts.",
              color: "#8b5cf6"
            }
          ].map((insight, index) => (
            <div
              key={index}
              className="p-4 rounded-lg border-l-4"
              style={{ background: "var(--bg-hover)", borderColor: insight.color, borderLeftColor: insight.color }}
            >
              <h3 className="font-semibold text-sm mb-1" style={{ color: insight.color }}>{insight.title}</h3>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{insight.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
