"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Zap, BarChart3, Target, Activity, Sparkles } from "lucide-react";
import { requireWorkspaceId } from "@/lib/workspace";
import { useQuery } from "@tanstack/react-query";
import { listContent } from "@/services/content";
import type { Content } from "@/types";

interface ViralScore {
  draft_id: string;
  total_score: number;
  breakdown: {
    hook_strength: number;
    emotional_trigger: number;
    trend_alignment: number;
    historical_performance: number;
    content_uniqueness: number;
    platform_algorithm_fit: number;
  };
  viral_probability: string;
  recommendation: string;
  optimal_schedule_window: {
    day: string;
    time: string;
  };
}

export default function ViralScoringPage() {
  const workspaceId = requireWorkspaceId();
  const [mounted, setMounted] = useState(false);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: content } = useQuery<Content[]>({
    queryKey: ["content", workspaceId],
    queryFn: () => listContent(workspaceId),
    enabled: !!workspaceId && mounted,
  });

  // Mock viral scores for demonstration
  const getMockViralScore = (contentId: string): ViralScore => ({
    draft_id: contentId,
    total_score: Math.floor(Math.random() * 40) + 60,
    breakdown: {
      hook_strength: Math.floor(Math.random() * 8) + 12,
      emotional_trigger: Math.floor(Math.random() * 6) + 14,
      trend_alignment: Math.floor(Math.random() * 7) + 13,
      historical_performance: Math.floor(Math.random() * 8) + 12,
      content_uniqueness: Math.floor(Math.random() * 4) + 6,
      platform_algorithm_fit: Math.floor(Math.random() * 4) + 6,
    },
    viral_probability: ["Low", "Medium", "High", "Very High"][Math.floor(Math.random() * 4)],
    recommendation: [
      "Great content! Schedule immediately at peak time.",
      "Good potential. Consider tweaking the hook for better engagement.",
      "Decent score. Try adding more emotional triggers.",
      "Needs improvement. Consider rewriting with stronger hooks.",
    ][Math.floor(Math.random() * 4)],
    optimal_schedule_window: {
      day: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][Math.floor(Math.random() * 5)],
      time: ["9:00 AM", "12:00 PM", "2:00 PM", "5:00 PM", "7:00 PM"][Math.floor(Math.random() * 5)],
    },
  });

  if (!mounted) {
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
          Viral Scoring <TrendingUp className="inline-block ml-2 h-8 w-8" />
        </h1>
        <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
          AI-powered viral potential analysis for your content before publishing
        </p>
      </div>

      {/* Score Distribution Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border p-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <Zap className="h-6 w-6 text-yellow-500" />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Excellent</span>
          </div>
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>12</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Score 80-100</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border p-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <Activity className="h-6 w-6 text-emerald-500" />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Good</span>
          </div>
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>28</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Score 60-79</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border p-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <Target className="h-6 w-6 text-orange-500" />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Average</span>
          </div>
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>15</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Score 40-59</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border p-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <BarChart3 className="h-6 w-6 text-red-500" />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Needs Work</span>
          </div>
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>5</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Score &lt;40</p>
        </motion.div>
      </div>

      {/* Content List with Scores */}
      <div className="rounded-xl border p-6 mb-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          Content Viral Scores
        </h2>

        <div className="space-y-3">
          {content && content.length > 0 ? (
            content.map((item) => {
              const score = getMockViralScore(item.id);
              const isSelected = selectedContent === item.id;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`rounded-lg border p-4 cursor-pointer transition-all ${
                    isSelected ? "border-indigo-500" : "hover:border-gray-400"
                  }`}
                  style={{ background: isSelected ? "var(--bg-hover)" : "var(--bg-primary)", borderColor: isSelected ? "#6366f1" : "var(--border-color)" }}
                  onClick={() => setSelectedContent(item.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                          {item.title || "Untitled"}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          score.total_score >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" :
                          score.total_score >= 60 ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                          score.total_score >= 40 ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" :
                          "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        }`}>
                          {score.total_score}/100
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full" style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}>
                          {item.platform}
                        </span>
                      </div>
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        Viral Probability: <span className="font-medium" style={{ color: "var(--text-primary)" }}>{score.viral_probability}</span>
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{
                        background: `conic-gradient(#6366f1 ${score.total_score * 3.6}deg, var(--bg-card) 0deg)`
                      }}>
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
                          <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{score.total_score}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-4 pt-4 border-t"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        {/* Score Breakdown */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm" style={{ color: "var(--text-secondary)" }}>Score Breakdown</h4>
                          {[
                            { label: "Hook Strength", value: score.breakdown.hook_strength, max: 20, icon: "🎯" },
                            { label: "Emotional Trigger", value: score.breakdown.emotional_trigger, max: 20, icon: "💡" },
                            { label: "Trend Alignment", value: score.breakdown.trend_alignment, max: 20, icon: "📈" },
                            { label: "Historical Performance", value: score.breakdown.historical_performance, max: 20, icon: "📊" },
                            { label: "Content Uniqueness", value: score.breakdown.content_uniqueness, max: 10, icon: "✨" },
                            { label: "Platform Algorithm Fit", value: score.breakdown.platform_algorithm_fit, max: 10, icon: "⚙️" },
                          ].map((factor) => (
                            <div key={factor.label}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                  {factor.icon} {factor.label}
                                </span>
                                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                                  {factor.value}/{factor.max}
                                </span>
                              </div>
                              <div className="w-full h-2 rounded-full" style={{ background: "var(--bg-hover)" }}>
                                <div
                                  className="h-2 rounded-full transition-all"
                                  style={{
                                    width: `${(factor.value / factor.max) * 100}%`,
                                    background: factor.value / factor.max >= 0.8 ? "#10b981" : factor.value / factor.max >= 0.6 ? "#3b82f6" : "#f59e0b"
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Recommendation */}
                        <div className="md:col-span-2 space-y-4">
                          <div>
                            <h4 className="font-semibold text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
                              <Sparkles className="inline-block h-4 w-4 mr-1" />
                              AI Recommendation
                            </h4>
                            <p className="text-sm p-3 rounded-lg" style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}>
                              {score.recommendation}
                            </p>
                          </div>

                          <div>
                            <h4 className="font-semibold text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
                              Optimal Schedule Window
                            </h4>
                            <div className="flex gap-3">
                              <div className="flex-1 p-3 rounded-lg text-center" style={{ background: "var(--bg-hover)" }}>
                                <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Best Day</p>
                                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{score.optimal_schedule_window.day}</p>
                              </div>
                              <div className="flex-1 p-3 rounded-lg text-center" style={{ background: "var(--bg-hover)" }}>
                                <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Best Time</p>
                                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{score.optimal_schedule_window.time}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button className="flex-1 py-2 px-4 rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-700">
                              Schedule at Optimal Time
                            </button>
                            <button className="flex-1 py-2 px-4 rounded-lg font-medium border hover:opacity-80" style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", background: "var(--bg-hover)" }}>
                              Regenerate Content
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-20" style={{ color: "var(--text-secondary)" }} />
              <p style={{ color: "var(--text-secondary)" }}>No content to analyze yet</p>
              <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>Generate some content to see viral scores</p>
            </div>
          )}
        </div>
      </div>

      {/* Scoring Guide */}
      <div className="rounded-xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          How Viral Scoring Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: "🎯",
              title: "Hook Strength (0-20)",
              description: "AI rates your opening line's ability to grab attention and create curiosity"
            },
            {
              icon: "💡",
              title: "Emotional Trigger (0-20)",
              description: "Pattern matching across 5 viral emotions: awe, surprise, joy, anger, anticipation"
            },
            {
              icon: "📈",
              title: "Trend Alignment (0-20)",
              description: "Cross-reference with cached trending keywords and topics in your niche"
            },
            {
              icon: "📊",
              title: "Historical Performance (0-20)",
              description: "Qdrant similarity search vs your past successful posts for pattern matching"
            },
            {
              icon: "✨",
              title: "Content Uniqueness (0-10)",
              description: "Penalizes near-duplicate content to ensure fresh, original posts"
            },
            {
              icon: "⚙️",
              title: "Platform Algorithm Fit (0-10)",
              description: "Checks character length, hashtag count, and platform-specific boost keywords"
            },
          ].map((factor) => (
            <div
              key={factor.title}
              className="p-4 rounded-lg border"
              style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)" }}
            >
              <div className="text-3xl mb-2">{factor.icon}</div>
              <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--text-primary)" }}>{factor.title}</h3>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{factor.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
