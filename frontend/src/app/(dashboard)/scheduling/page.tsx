"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, Clock, Zap, RefreshCw, CheckCircle, BarChart3 } from "lucide-react";
import { listContent, autoScheduleContent, getOptimalTime, bulkAutoSchedule, scheduleContentManually } from "@/services/content";
import { requireWorkspaceId, fetchAndStoreWorkspace } from "@/lib/workspace";
import type { Content } from "@/types";
import { capitalize } from "@/lib/utils";
import toast from "react-hot-toast";
import Link from "next/link";

interface OptimalTimeResult {
  best_slot: {
    day_of_week: number;
    hour: number;
    scheduled_at: string;
  };
  alternative_slots: Array<{
    day_of_week: number;
    hour: number;
    score: number;
    scheduled_at: string;
  }>;
  confidence: number;
  reasoning: string;
}

interface ViralScoreResult {
  total_score: number;
  breakdown?: {
    hook?: number;
    emotion?: number;
    trend?: number;
    historical?: number;
    uniqueness?: number;
    algorithm?: number;
  };
  recommendation: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function SchedulingPage() {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState("");
  const [activeTab, setActiveTab] = useState<"ready" | "scheduled">("ready");
  const [readyContent, setReadyContent] = useState<Content[]>([]);
  const [scheduledContent, setScheduledContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [bulkScheduling, setBulkScheduling] = useState(false);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [optimalTime, setOptimalTime] = useState<OptimalTimeResult | null>(null);
  const [viralScore, setViralScore] = useState<ViralScoreResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const id = requireWorkspaceId();
    if (!id) {
      fetchAndStoreWorkspace()
        .then(fetched => {
          if (fetched) {
            setWorkspaceId(fetched);
            loadContent(fetched);
          } else {
            setLoading(false);
          }
        })
        .catch(() => {
          setLoading(false);
        });
    } else {
      setWorkspaceId(id);
      loadContent(id);
    }
  }, []);

  const loadContent = async (wsId?: string) => {
    const targetId = wsId || workspaceId;
    if (!targetId) return;
    try {
      const allContent = await listContent(targetId);
      setReadyContent(allContent.filter(c => c.status === "draft" || c.status === "approved"));
      setScheduledContent(allContent.filter(c => c.status === "scheduled"));
    } catch {
      toast.error("Failed to load content");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (content: Content) => {
    // Don't re-analyze if this content is already selected
    if (selectedContent?.id === content.id) return;

    setSelectedContent(content);
    setAnalyzing(true);
    setOptimalTime(null);
    setViralScore(null);

    // Dismiss any existing toasts before showing a new one
    toast.dismiss();

    try {
      const result = await getOptimalTime(content.id);
      setViralScore(result.viral_score);
      setOptimalTime(result.optimal_time);
      toast.success("AI analysis complete!", { id: "analyze-result" });
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to analyze", { id: "analyze-error" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAutoSchedule = async (content: Content) => {
    setScheduling(content.id);
    // Dismiss any existing toasts before showing schedule result
    toast.dismiss();
    try {
      const result = await autoScheduleContent(content.id);
      setSelectedContent(content);
      setViralScore(result.viral_score);
      setOptimalTime(result.optimal_times);
      
      if (result.decision.action === "auto_scheduled") {
        toast.success(`✅ Auto-scheduled!`, { id: "schedule-result" });
        setTimeout(() => {
          loadContent();
          setSelectedContent(null);
          setViralScore(null);
          setOptimalTime(null);
        }, 2000);
      } else {
        // Show single toast with unique ID so it never stacks
        toast(result.decision.reason, { icon: "ℹ️", id: "schedule-info", duration: 5000 });
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to schedule", { id: "schedule-error" });
    } finally {
      setScheduling(null);
    }
  };

  const executeSchedule = async (scheduledAt: string) => {
    if (!selectedContent || scheduling) return;
    
    setScheduling(selectedContent.id);
    try {
      await scheduleContentManually(selectedContent.id, scheduledAt);
      toast.success("✅ Content scheduled successfully!");
      setTimeout(() => {
        loadContent();
        setSelectedContent(null);
        setViralScore(null);
        setOptimalTime(null);
      }, 2000);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to schedule");
    } finally {
      setScheduling(null);
    }
  };

  const handleConfirmSchedule = () => {
    if (optimalTime?.best_slot?.scheduled_at) {
      executeSchedule(optimalTime.best_slot.scheduled_at);
    }
  };

  const handleScheduleAtTime = (scheduledAt: string) => {
    executeSchedule(scheduledAt);
  };

  const handleBulkSchedule = async () => {
    if (readyContent.length === 0) return;
    
    setBulkScheduling(true);
    try {
      const result = await bulkAutoSchedule(workspaceId, readyContent.map(c => c.id));
      toast.success(`✅ Scheduled ${result.auto_scheduled} posts`);
      loadContent();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to bulk schedule");
    } finally {
      setBulkScheduling(false);
    }
  };

  const formatTimeSlot = (dayOfWeek: number, hour: number) => {
    const day = DAY_NAMES[dayOfWeek];
    const time = new Date();
    time.setHours(hour, 0, 0, 0);
    return `${day} at ${time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-4xl animate-spin" style={{ color: "#6366f1" }}>progress_activity</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>AI Scheduling</h1>
          <p className="mt-2" style={{ color: "var(--text-secondary)" }}>AI finds the best time to post your content</p>
        </div>
        <button
          onClick={handleBulkSchedule}
          disabled={bulkScheduling || readyContent.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {bulkScheduling ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {bulkScheduling ? "Scheduling..." : `Schedule All (${readyContent.length})`}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setActiveTab("ready"); setSelectedContent(null); }}
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === "ready" ? "bg-indigo-600 text-white" : "bg-white/5 text-gray-400"}`}
        >
          Ready to Schedule ({readyContent.length})
        </button>
        <button
          onClick={() => { setActiveTab("scheduled"); setSelectedContent(null); }}
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === "scheduled" ? "bg-indigo-600 text-white" : "bg-white/5 text-gray-400"}`}
        >
          Scheduled ({scheduledContent.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === "ready" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Content List */}
          <div className="lg:col-span-1 space-y-3">
            {readyContent.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" style={{ color: "var(--text-secondary)" }} />
                <p style={{ color: "var(--text-secondary)" }}>No content ready to schedule</p>
                <Link href="/content/generate" className="text-sm mt-4 inline-block" style={{ color: "#6366f1" }}>
                  Create Content →
                </Link>
              </div>
            ) : (
              readyContent.map((content) => (
                <motion.div
                  key={content.id}
                  onClick={() => handleAnalyze(content)}
                  className={`glass-card rounded-xl p-4 cursor-pointer transition-all ${
                    selectedContent?.id === content.id ? "ring-2 ring-indigo-500" : "hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {content.title || "Untitled"}
                      </h3>
                      <p className="text-xs capitalize mt-1" style={{ color: "var(--text-secondary)" }}>
                        {content.platform} • {content.status}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAutoSchedule(content); }}
                    disabled={scheduling === content.id}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {scheduling === content.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                    AI Schedule
                  </button>
                </motion.div>
              ))
            )}
          </div>

          {/* Right: AI Analysis */}
          <div className="lg:col-span-2">
            {!selectedContent ? (
              <div className="glass-card rounded-xl p-12 text-center">
                <Calendar className="h-16 w-16 mx-auto mb-4 opacity-30" style={{ color: "var(--text-secondary)" }} />
                <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                  Select Content to Analyze
                </h3>
                <p style={{ color: "var(--text-secondary)" }}>AI will find the best posting time</p>
              </div>
            ) : analyzing ? (
              <div className="glass-card rounded-xl p-12 text-center">
                <span className="material-symbols-outlined text-4xl animate-spin block mb-4" style={{ color: "#6366f1" }}>progress_activity</span>
                <p style={{ color: "var(--text-secondary)" }}>AI is analyzing...</p>
              </div>
            ) : optimalTime && viralScore ? (
              <div className="space-y-4">
                {/* Viral Score */}
                <div className="glass-card rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                      <BarChart3 className="h-5 w-5" /> Viral Score
                    </h3>
                    <span className="text-2xl font-bold" style={{ color: viralScore.total_score >= 65 ? "#10b981" : viralScore.total_score >= 40 ? "#f59e0b" : "#ef4444" }}>
                      {viralScore.total_score}/100
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 mb-4">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${viralScore.total_score}%`, background: viralScore.total_score >= 65 ? "#10b981" : viralScore.total_score >= 40 ? "#f59e0b" : "#ef4444" }}
                    />
                  </div>
                  <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{viralScore.recommendation}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {viralScore.breakdown && Object.entries(viralScore.breakdown).map(([key, value]) => (
                      <div key={key} className="p-3 rounded-lg" style={{ background: "var(--bg-hover)" }}>
                        <p className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>{key}</p>
                        <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Optimal Time */}
                <div className="glass-card rounded-xl p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                    <Clock className="h-5 w-5" /> Best Time to Post
                  </h3>
                  <div className="p-4 rounded-lg mb-4" style={{ background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
                    <p className="text-lg font-bold" style={{ color: "#6366f1" }}>
                      {formatTimeSlot(optimalTime.best_slot.day_of_week, optimalTime.best_slot.hour)}
                    </p>
                    <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>{optimalTime.reasoning}</p>
                  </div>
                  {optimalTime.alternative_slots.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Alternative Times:</p>
                      <div className="space-y-2">
                        {optimalTime.alternative_slots.slice(0, 2).map((slot, i) => (
                          <div 
                            key={i} 
                            onClick={() => !scheduling && handleScheduleAtTime(slot.scheduled_at)}
                            className={`flex justify-between p-3 rounded-lg border transition-all ${
                              scheduling 
                                ? "opacity-50 cursor-not-allowed border-transparent" 
                                : "cursor-pointer hover:bg-indigo-600/10 border-transparent hover:border-indigo-500/20 active:scale-[0.99]"
                            }`}
                            style={{ background: "var(--bg-hover)" }}
                          >
                            <span style={{ color: "var(--text-primary)" }}>{formatTimeSlot(slot.day_of_week, slot.hour)}</span>
                            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Score: {slot.score.toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action */}
                <button
                  onClick={handleConfirmSchedule}
                  disabled={!!scheduling}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all"
                >
                  {scheduling === selectedContent.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {scheduling === selectedContent.id ? "Scheduling..." : "Confirm & Schedule"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        /* Scheduled Tab */
        <div className="space-y-3">
          {scheduledContent.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" style={{ color: "var(--text-secondary)" }} />
              <p style={{ color: "var(--text-secondary)" }}>No scheduled posts</p>
            </div>
          ) : (
            scheduledContent.map((content) => (
              <div key={content.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium" style={{ color: "var(--text-primary)" }}>{content.title || "Untitled"}</h3>
                  <p className="text-sm capitalize" style={{ color: "var(--text-secondary)" }}>{content.platform}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium" style={{ color: "#6366f1" }}>
                    {content.scheduled_at ? new Date(content.scheduled_at).toLocaleString() : "Not set"}
                  </p>
                  <span className="text-xs px-2 py-1 rounded bg-indigo-500/20" style={{ color: "#6366f1" }}>Scheduled</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
