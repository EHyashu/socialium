"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Send, Settings, Zap, BarChart3 } from "lucide-react";
import toast from "react-hot-toast";
import { requireWorkspaceId, fetchAndStoreWorkspace } from "@/lib/workspace";
import api from "@/lib/api";

interface AutoReplyConfig {
  workspace_id: string;
  platform: string;
  is_enabled: boolean;
  reply_tone: string;
  max_replies_per_day: number;
  sentiment_threshold: number;
  excluded_keywords: string[];
}

export default function AutoReplyPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [mounted, setMounted] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("linkedin");
  const [selectedTone, setSelectedTone] = useState("professional");
  const [generatedReply, setGeneratedReply] = useState("");
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<AutoReplyConfig>({
    workspace_id: "",
    platform: "linkedin",
    is_enabled: true,
    reply_tone: "professional",
    max_replies_per_day: 50,
    sentiment_threshold: 0.6,
    excluded_keywords: [],
  });

  useEffect(() => {
    setMounted(true);
    const id = requireWorkspaceId();
    if (!id) {
      fetchAndStoreWorkspace().then(fetched => {
        if (fetched) {
          setWorkspaceId(fetched);
          setConfig(prev => ({ ...prev, workspace_id: fetched }));
        }
      });
    } else {
      setWorkspaceId(id);
      setConfig(prev => ({ ...prev, workspace_id: id }));
    }
  }, []);

  const handleTestReply = async () => {
    if (!commentText.trim()) {
      toast.error("Please enter a comment to test");
      return;
    }

    setTesting(true);
    try {
      const res = await api.post(
        `/auto-reply/test?comment_text=${encodeURIComponent(
          commentText
        )}&platform=${selectedPlatform}&tone=${selectedTone}`
      );

      const data = res.data;
      
      if (data.should_reply && data.reply) {
        setGeneratedReply(data.reply);
        toast.success("Reply generated!");
      } else {
        setGeneratedReply("");
        toast("AI decided not to reply to this comment");
      }
    } catch (error) {
      toast.error("Failed to generate reply");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await api.post("/auto-reply/config", config);
      toast.success("Auto-reply configuration saved!");
    } catch (error) {
      toast.error("Failed to save configuration");
    }
  };

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
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>24</p>
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
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>0.82</p>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>Positive Engagement</p>
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
          <p className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{config.is_enabled ? "ON" : "OFF"}</p>
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
                Sentiment Threshold ({config.sentiment_threshold})
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

      {/* Recent Activity */}
      <div className="mt-6 rounded-xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          Recent Activity
        </h2>
        <div className="space-y-3">
          {[
            { platform: "LinkedIn", comment: "Great insights! Thanks for sharing.", sentiment: 0.92, time: "2 min ago" },
            { platform: "Twitter", comment: "This is exactly what I needed to hear today.", sentiment: 0.88, time: "15 min ago" },
            { platform: "Instagram", comment: "Love this content! Keep it up 🔥", sentiment: 0.95, time: "1 hour ago" },
          ].map((activity, index) => (
            <div
              key={index}
              className="flex items-start justify-between p-4 rounded-lg border"
              style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)" }}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium px-2 py-1 rounded" style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}>
                    {activity.platform}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{activity.time}</span>
                </div>
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>{activity.comment}</p>
              </div>
              <div className="text-right ml-4">
                <p className="text-xs font-medium" style={{ color: activity.sentiment > 0.8 ? "#10b981" : "#f59e0b" }}>
                  Sentiment: {activity.sentiment}
                </p>
                <p className="text-xs mt-1" style={{ color: "#10b981" }}>✓ Replied</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
