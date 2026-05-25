"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Send, Settings, Zap, BarChart3 } from "lucide-react";
import toast from "react-hot-toast";
import { requireWorkspaceId } from "@/lib/workspace";
import { testAutoReply, saveAutoReplyConfig, getAutoReplyStats, getAutoReplyActivity } from "@/services/auto-reply";

interface AutoReplyConfig {
  workspace_id: string;
  platform: string;
  is_enabled: boolean;
  reply_tone: string;
  max_replies_per_day: number;
  sentiment_threshold: number;
  excluded_keywords: string[];
}

interface Activity {
  id: string;
  platform: string;
  comment_text: string;
  reply_text: string | null;
  sentiment_score: number;
  created_at: string;
}

export default function AutoReplyPage() {
  const workspaceId = requireWorkspaceId();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("linkedin");
  const [selectedTone, setSelectedTone] = useState("professional");
  const [generatedReply, setGeneratedReply] = useState("");
  const [testing, setTesting] = useState(false);
  const [stats, setStats] = useState({
    total_replies_today: 0,
    average_sentiment: 0,
    is_enabled: true,
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [config, setConfig] = useState<AutoReplyConfig>({
    workspace_id: workspaceId,
    platform: "linkedin",
    is_enabled: true,
    reply_tone: "professional",
    max_replies_per_day: 50,
    sentiment_threshold: 0.6,
    excluded_keywords: [],
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!workspaceId || !mounted) return;
    
    loadRealData();
  }, [workspaceId, mounted]);

  const loadRealData = async () => {
    try {
      setLoading(true);
      const [statsData, activityData] = await Promise.all([
        getAutoReplyStats(workspaceId).catch(() => ({
          total_replies_today: 0,
          average_sentiment: 0,
          is_enabled: config.is_enabled,
        })),
        getAutoReplyActivity(workspaceId).catch(() => []),
      ]);
      
      setStats(statsData);
      setActivities(activityData);
      setConfig(prev => ({
        ...prev,
        is_enabled: statsData.is_enabled ?? prev.is_enabled,
      }));
    } catch (error) {
      console.error("Failed to load auto-reply data:", error);
      toast.error("Failed to load auto-reply data");
    } finally {
      setLoading(false);
    }
  };

  const handleTestReply = async () => {
    if (!commentText.trim()) {
      toast.error("Please enter a comment to test");
      return;
    }

    setTesting(true);
    try {
      const data = await testAutoReply(commentText, selectedPlatform, selectedTone);
      
      if (data.should_reply && data.reply) {
        setGeneratedReply(data.reply);
        toast.success("Reply generated!");
      } else {
        setGeneratedReply("");
        toast("AI decided not to reply to this comment", { icon: "ℹ️" });
      }
    } catch (error) {
      console.error("Failed to generate reply:", error);
      toast.error("Failed to generate reply");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await saveAutoReplyConfig(config);
      toast.success("Auto-reply configuration saved!");
      loadRealData();
    } catch (error) {
      console.error("Failed to save configuration:", error);
      toast.error("Failed to save configuration");
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
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
          Auto Reply <MessageCircle className="inline-block ml-2 h-8 w-8" />
        </h1>
        <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
          AI-powered automatic replies to comments and DMs with sentiment analysis
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border p-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <Zap className="h-6 w-6 text-indigo-500" />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Today</span>
          </div>
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            {stats.total_replies_today}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Auto Replies Sent</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border p-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <BarChart3 className="h-6 w-6 text-emerald-500" />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Avg Sentiment</span>
          </div>
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            {stats.average_sentiment.toFixed(2)}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {stats.average_sentiment > 0.7 ? "Positive" : stats.average_sentiment > 0.4 ? "Neutral" : "Negative"} Engagement
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border p-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <Settings className="h-6 w-6 text-purple-500" />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Active</span>
          </div>
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            {stats.is_enabled ? "ON" : "OFF"}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Auto-Reply Status</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Auto Reply */}
        <div className="rounded-xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            Test Auto Reply
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                Platform
              </label>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="w-full rounded-lg border p-3"
                style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              >
                <option value="linkedin">LinkedIn</option>
                <option value="twitter">Twitter/X</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                Reply Tone
              </label>
              <select
                value={selectedTone}
                onChange={(e) => setSelectedTone(e.target.value)}
                className="w-full rounded-lg border p-3"
                style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="casual">Casual</option>
                <option value="empathetic">Empathetic</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                Comment/DM Text
              </label>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Paste a comment or DM to test AI reply..."
                className="w-full h-32 rounded-lg border p-3"
                style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>

            <button
              onClick={handleTestReply}
              disabled={testing}
              className="w-full rounded-lg py-3 px-4 font-medium flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {testing ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  Generating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Generate Reply
                </>
              )}
            </button>

            {generatedReply && (
              <div className="rounded-lg border p-4" style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)" }}>
                <p className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>AI Generated Reply:</p>
                <p style={{ color: "var(--text-primary)" }}>{generatedReply}</p>
              </div>
            )}
          </div>
        </div>

        {/* Configuration */}
        <div className="rounded-xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            Configuration
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>Enable Auto Reply</span>
              <button
                onClick={() => setConfig({ ...config, is_enabled: !config.is_enabled })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  config.is_enabled ? "bg-indigo-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    config.is_enabled ? "translate-x-6" : ""
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                Max Replies Per Day
              </label>
              <input
                type="number"
                value={config.max_replies_per_day}
                onChange={(e) => setConfig({ ...config, max_replies_per_day: parseInt(e.target.value) })}
                className="w-full rounded-lg border p-3"
                style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                Sentiment Threshold ({config.sentiment_threshold.toFixed(2)})
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={config.sentiment_threshold * 100}
                onChange={(e) => setConfig({ ...config, sentiment_threshold: parseInt(e.target.value) / 100 })}
                className="w-full"
              />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Only reply to comments with sentiment above this threshold
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                Default Reply Tone
              </label>
              <select
                value={config.reply_tone}
                onChange={(e) => setConfig({ ...config, reply_tone: e.target.value })}
                className="w-full rounded-lg border p-3"
                style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="casual">Casual</option>
                <option value="empathetic">Empathetic</option>
              </select>
            </div>

            <button
              onClick={handleSaveConfig}
              className="w-full rounded-lg py-3 px-4 font-medium bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity - REAL DATA */}
      <div className="mt-6 rounded-xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          Recent Activity
        </h2>
        {activities.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" style={{ color: "var(--text-secondary)" }} />
            <p className="text-lg font-medium" style={{ color: "var(--text-secondary)" }}>No auto-replies yet</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Activity will appear here when auto-replies are sent
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 10).map((activity) => (
              <div
                key={activity.id}
                className="flex items-start justify-between p-4 rounded-lg border"
                style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)" }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium px-2 py-1 rounded" style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}>
                      {activity.platform}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {formatTimeAgo(activity.created_at)}
                    </span>
                  </div>
                  <p className="text-sm mb-2" style={{ color: "var(--text-primary)" }}>{activity.comment_text}</p>
                  {activity.reply_text && (
                    <div className="p-2 rounded text-sm" style={{ background: "var(--bg-card)" }}>
                      <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Reply: </span>
                      <span style={{ color: "var(--text-primary)" }}>{activity.reply_text}</span>
                    </div>
                  )}
                </div>
                <div className="text-right ml-4">
                  <p className="text-xs font-medium" style={{ 
                    color: activity.sentiment_score > 0.7 ? "#10b981" : activity.sentiment_score > 0.4 ? "#f59e0b" : "#ef4444" 
                  }}>
                    Sentiment: {activity.sentiment_score.toFixed(2)}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#10b981" }}>✓ Replied</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
