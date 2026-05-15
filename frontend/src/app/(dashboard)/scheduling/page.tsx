"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Calendar,
  Clock,
  Flame,
  Sparkles,
  Users,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Send,
} from "lucide-react";
import {
  listScheduled,
  listDraftsReady,
  getViralScore,
  getOptimalTimes,
  autoSchedule,
  bulkAutoSchedule,
  publishNow,
} from "@/services/scheduling";
import type { ScheduledPost, Platform } from "@/types";
import { formatDateTime, capitalize } from "@/lib/utils";
import toast from "react-hot-toast";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface DraftItem {
  id: string;
  title: string | null;
  body: string | null;
  platform: Platform | null;
  status: string;
  quality_score: number | null;
  created_at: string | null;
}

interface ViralScoreData {
  draft_id: string;
  total_score: number;
  breakdown: Record<string, number>;
  viral_probability: string;
  recommendation: string;
  optimal_schedule_window: Record<string, unknown>;
}

interface TimeSlotData {
  day_of_week: number;
  day_name: string;
  hour: number;
  hour_label: string;
  score: number;
  scheduled_at: string | null;
  data_source: string;
}

interface OptimalTimeData {
  best_slot: TimeSlotData;
  alternative_slots: TimeSlotData[];
  confidence: number;
  confidence_label: string;
  reasoning: string;
}

interface AutoScheduleResult {
  content_id: string;
  viral_score: ViralScoreData;
  optimal_times: OptimalTimeData;
  decision: {
    should_auto_schedule: boolean;
    reason: string;
    action: string;
    scheduled_time: string | null;
    suggested_times: TimeSlotData[];
    improvement_suggestion: string;
  };
  scheduled_at: string | null;
}

// ─── Platform colors ────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "bg-blue-100 text-blue-700",
  twitter: "bg-sky-100 text-sky-700",
  instagram: "bg-pink-100 text-pink-700",
  facebook: "bg-indigo-100 text-indigo-700",
};

const PLATFORM_DOT_COLORS: Record<string, string> = {
  linkedin: "bg-blue-500",
  twitter: "bg-sky-500",
  instagram: "bg-pink-500",
  facebook: "bg-indigo-500",
};

// ─── Helper components ──────────────────────────────────────────────────────────

function ScoreBar({ score, max, label }: { score: number; max: number; label: string }) {
  const pct = Math.min((score / max) * 100, 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-32 truncate">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-10 text-right">
        {score}/{max}
      </span>
    </div>
  );
}

function ActivityBar({ day, value, maxValue, isBest }: { day: string; value: number; maxValue: number; isBest: boolean }) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-20">{day}</span>
      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isBest ? "bg-green-500" : "bg-purple-400"}`}
          style={{ width: `${Math.max(pct, 8)}%` }}
        />
      </div>
      {isBest && <span className="text-xs text-green-600 font-medium">Best</span>}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function SchedulingPage() {
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<DraftItem | null>(null);
  const [viralScore, setViralScore] = useState<ViralScoreData | null>(null);
  const [optimalTimes, setOptimalTimes] = useState<OptimalTimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoringLoading, setScoringLoading] = useState(false);
  const [schedulingLoading, setSchedulingLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Load data
  useEffect(() => {
    async function load() {
      try {
        const [draftsData, scheduledData] = await Promise.all([
          listDraftsReady(),
          listScheduled(),
        ]);
        setDrafts(draftsData);
        setScheduled(scheduledData);
      } catch {
        toast.error("Failed to load scheduling data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // When a draft is selected, fetch its viral score + optimal times
  const handleSelectDraft = useCallback(async (draft: DraftItem) => {
    setSelectedDraft(draft);
    setViralScore(null);
    setOptimalTimes(null);
    setScoringLoading(true);

    try {
      const [score, times] = await Promise.all([
        getViralScore(draft.id),
        getOptimalTimes(draft.platform || "linkedin", {
          viral_score: 50,
        }),
      ]);
      setViralScore(score);
      setOptimalTimes(times);
    } catch {
      toast.error("Failed to load AI analysis");
    } finally {
      setScoringLoading(false);
    }
  }, []);

  // Auto-schedule single draft
  const handleAutoSchedule = async (draftId: string) => {
    setSchedulingLoading(true);
    try {
      const result: AutoScheduleResult = await autoSchedule(draftId);
      const { decision } = result;

      if (decision.action === "auto_scheduled" && result.scheduled_at) {
        toast.success(`Scheduled for ${formatDateTime(result.scheduled_at)}`);
        setDrafts((prev) => prev.filter((d) => d.id !== draftId));
        const refreshed = await listScheduled();
        setScheduled(refreshed);
        setSelectedDraft(null);
        setViralScore(null);
        setOptimalTimes(null);
      } else if (decision.action === "improve_content") {
        toast.error(decision.improvement_suggestion || "Content needs improvement");
      } else if (decision.action === "confirm_schedule" || decision.action === "suggest_times") {
        toast(decision.reason, { icon: "📅" });
      }
    } catch {
      toast.error("Auto-scheduling failed");
    } finally {
      setSchedulingLoading(false);
    }
  };

  // Bulk auto-schedule all drafts
  const handleBulkSchedule = async () => {
    if (drafts.length === 0) return;
    setBulkLoading(true);
    try {
      const result = await bulkAutoSchedule(
        "",
        drafts.map((d) => d.id)
      );
      toast.success(
        `Scheduled ${result.auto_scheduled} posts. ${result.needs_confirmation} need confirmation.`
      );
      const [refreshedDrafts, refreshedScheduled] = await Promise.all([
        listDraftsReady(),
        listScheduled(),
      ]);
      setDrafts(refreshedDrafts);
      setScheduled(refreshedScheduled);
      setSelectedDraft(null);
    } catch {
      toast.error("Bulk scheduling failed");
    } finally {
      setBulkLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-600" />
            AI Scheduling
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            The AI decides the best time to publish — you just approve
          </p>
        </div>
        {drafts.length > 1 && (
          <button
            onClick={handleBulkSchedule}
            disabled={bulkLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {bulkLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Auto-Schedule All ({drafts.length})
          </button>
        )}
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN: Drafts ready to schedule */}
        <div className="lg:col-span-3 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Ready to Schedule
          </h2>
          {drafts.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-green-400" />
              <p className="text-sm text-gray-500 mt-2">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
              {drafts.map((draft) => (
                <button
                  key={draft.id}
                  onClick={() => handleSelectDraft(draft)}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    selectedDraft?.id === draft.id
                      ? "border-purple-400 bg-purple-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {draft.platform && (
                      <span
                        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                          PLATFORM_COLORS[draft.platform] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {capitalize(draft.platform)}
                      </span>
                    )}
                    {draft.quality_score && (
                      <span className="text-[10px] text-gray-400">
                        Score: {draft.quality_score}/10
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 line-clamp-2">
                    {draft.body || draft.title || "Untitled draft"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* MIDDLE COLUMN: AI Intelligence Panel */}
        <div className="lg:col-span-5 space-y-4">
          {!selectedDraft ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-300" />
              <p className="text-gray-500 mt-3">Select a draft to see AI analysis</p>
              <p className="text-sm text-gray-400 mt-1">
                Viral scoring, optimal times, and scheduling recommendations
              </p>
            </div>
          ) : scoringLoading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
              <p className="text-gray-500 mt-3">Analyzing viral potential...</p>
            </div>
          ) : (
            <>
              {/* Viral Score Card */}
              {viralScore && (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Flame className="h-5 w-5 text-orange-500" />
                    <h3 className="font-semibold text-gray-900">Viral Potential Score</h3>
                  </div>

                  {/* Score header */}
                  <div className="flex items-end gap-3 mb-4">
                    <span className="text-4xl font-bold text-gray-900">
                      {viralScore.total_score}
                    </span>
                    <span className="text-lg text-gray-400">/ 100</span>
                    <span
                      className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${
                        viralScore.total_score >= 65
                          ? "bg-green-100 text-green-700"
                          : viralScore.total_score >= 50
                          ? "bg-yellow-100 text-yellow-700"
                          : viralScore.total_score >= 35
                          ? "bg-orange-100 text-orange-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {viralScore.viral_probability}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-5">
                    <div
                      className={`h-full rounded-full transition-all ${
                        viralScore.total_score >= 65
                          ? "bg-green-500"
                          : viralScore.total_score >= 50
                          ? "bg-yellow-500"
                          : "bg-red-400"
                      }`}
                      style={{ width: `${viralScore.total_score}%` }}
                    />
                  </div>

                  {/* Breakdown */}
                  <div className="space-y-2.5">
                    <ScoreBar score={viralScore.breakdown.hook || 0} max={20} label="Hook strength" />
                    <ScoreBar score={viralScore.breakdown.emotion || 0} max={20} label="Emotional triggers" />
                    <ScoreBar score={viralScore.breakdown.trend || 0} max={20} label="Trend alignment" />
                    <ScoreBar score={viralScore.breakdown.historical || 0} max={20} label="Historical pattern" />
                    <ScoreBar score={viralScore.breakdown.uniqueness || 0} max={10} label="Content uniqueness" />
                    <ScoreBar score={viralScore.breakdown.algorithm || 0} max={10} label="Algorithm fit" />
                  </div>

                  {/* Recommendation */}
                  {viralScore.recommendation && (
                    <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
                      <p className="text-xs text-amber-800">
                        <span className="font-medium">💡 Improvement:</span>{" "}
                        {viralScore.recommendation}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Audience Activity */}
              {optimalTimes && (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-5 w-5 text-purple-500" />
                    <h3 className="font-semibold text-gray-900">Audience Activity</h3>
                  </div>

                  {/* Day heatmap */}
                  <div className="space-y-2 mb-4">
                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
                      (day, idx) => {
                        const slots = [optimalTimes.best_slot, ...optimalTimes.alternative_slots];
                        const daySlots = slots.filter((s) => s.day_of_week === idx);
                        const maxScore = Math.max(
                          optimalTimes.best_slot.score,
                          ...optimalTimes.alternative_slots.map((s) => s.score)
                        );
                        const dayScore = daySlots.length > 0
                          ? Math.max(...daySlots.map((s) => s.score))
                          : 0;
                        const isBest = optimalTimes.best_slot.day_of_week === idx;
                        return (
                          <ActivityBar
                            key={day}
                            day={day.slice(0, 3)}
                            value={dayScore}
                            maxValue={maxScore}
                            isBest={isBest}
                          />
                        );
                      }
                    )}
                  </div>

                  {/* Confidence */}
                  <p className="text-xs text-gray-500">
                    Confidence: <span className="font-medium">{optimalTimes.confidence_label}</span>
                  </p>
                </div>
              )}

              {/* AI Recommendation */}
              {optimalTimes && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <h3 className="font-semibold text-purple-900">AI Recommendation</h3>
                  </div>

                  <p className="text-sm text-purple-800 font-medium mb-2">
                    Schedule for: {optimalTimes.best_slot.day_name} at{" "}
                    {optimalTimes.best_slot.hour_label}
                  </p>
                  <p className="text-xs text-purple-700 mb-4">{optimalTimes.reasoning}</p>

                  {/* Alternative times */}
                  {optimalTimes.alternative_slots.length > 0 && (
                    <div className="mb-4 space-y-1">
                      <p className="text-xs text-purple-600 font-medium">Alternatives:</p>
                      {optimalTimes.alternative_slots.slice(0, 3).map((slot, idx) => (
                        <p key={idx} className="text-xs text-purple-600 pl-3">
                          ○ {slot.day_name} at {slot.hour_label}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => selectedDraft && handleAutoSchedule(selectedDraft.id)}
                      disabled={schedulingLoading}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      {schedulingLoading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Auto-Schedule Now
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN: Scheduled Calendar */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Scheduled ({scheduled.length})
          </h2>
          {scheduled.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
              <Calendar className="mx-auto h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500 mt-2">No posts scheduled yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
              {scheduled.map((post) => (
                <div
                  key={post.id}
                  className="rounded-xl border border-gray-200 bg-white p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {post.platform && (
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            PLATFORM_DOT_COLORS[post.platform] || "bg-gray-400"
                          }`}
                        />
                      )}
                      <span className="text-xs font-medium text-gray-700">
                        {post.platform ? capitalize(post.platform) : "—"}
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await publishNow(post.id);
                          setScheduled((prev) => prev.filter((p) => p.id !== post.id));
                          toast.success("Published!");
                        } catch {
                          toast.error("Failed to publish");
                        }
                      }}
                      className="text-xs text-green-600 hover:text-green-800 font-medium flex items-center gap-0.5"
                    >
                      <Send className="h-3 w-3" /> Publish
                    </button>
                  </div>
                  <p className="text-sm text-gray-800 line-clamp-2 mb-1">
                    {post.title || "Untitled"}
                  </p>
                  {post.scheduled_at && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(post.scheduled_at)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
