"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { requireWorkspaceId, fetchAndStoreWorkspace } from "@/lib/workspace";
import { listABTests, createABTest, evaluateABTest, cancelABTest } from "@/services/ab-testing";
import type { ABTest } from "@/types";
import toast from "react-hot-toast";

export default function ABTestingPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [mounted, setMounted] = useState(false);
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Form state
  const [testName, setTestName] = useState("");
  const [platform, setPlatform] = useState<"linkedin" | "twitter" | "instagram">("linkedin");
  const [variantA, setVariantA] = useState("");
  const [variantB, setVariantB] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setMounted(true);
    const id = requireWorkspaceId();
    if (!id) {
      fetchAndStoreWorkspace().then(fetched => {
        if (fetched) {
          setWorkspaceId(fetched);
          loadTests(fetched);
        } else {
          setLoading(false);
        }
      });
    } else {
      setWorkspaceId(id);
      loadTests(id);
    }
  }, []);

  const loadTests = async (wsId?: string) => {
    const targetId = wsId || workspaceId;
    if (!targetId) return;
    try {
      const data = await listABTests(targetId);
      setTests(data);
    } catch (error) {
      console.error("Failed to load A/B tests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTest = async () => {
    if (!testName.trim() || !variantA.trim() || !variantB.trim()) {
      toast.error("All fields are required");
      return;
    }

    setCreating(true);
    try {
      await createABTest({
        workspace_id: workspaceId,
        name: testName,
        platform,
        variant_a_body: variantA,
        variant_b_body: variantB,
      });
      
      toast.success("A/B test created!");
      setShowCreateModal(false);
      setTestName("");
      setVariantA("");
      setVariantB("");
      loadTests();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to create test");
    } finally {
      setCreating(false);
    }
  };

  const handleEvaluate = async (testId: string) => {
    try {
      const result = await evaluateABTest(testId);
      toast.success(`Test evaluated! Winner: Variant ${result.test.winner_variant || 'TBD'}`);
      loadTests();
    } catch (error: any) {
      toast.error("Failed to evaluate test");
    }
  };

  const handleCancel = async (testId: string) => {
    try {
      await cancelABTest(testId);
      toast.success("A/B test cancelled");
      loadTests();
    } catch (error: any) {
      toast.error("Failed to cancel test");
    }
  };

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <span className="material-symbols-outlined text-4xl animate-spin" style={{ color: "#6366f1" }}>progress_activity</span>
      </div>
    );
  }

  // Helper for platform-specific design
  const getPlatformConfig = (platformName: string) => {
    switch (platformName.toLowerCase()) {
      case "linkedin":
        return { color: "#0077b5", icon: "work", label: "LinkedIn" };
      case "twitter":
        return { color: "#1da1f2", icon: "share", label: "Twitter / X" };
      case "instagram":
        return { color: "#e1306c", icon: "photo_camera", label: "Instagram" };
      default:
        return { color: "#6366f1", icon: "star", label: platformName };
    }
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
            A/B Testing
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
            Test different content variations to optimize audience engagement & conversion
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-500/20 active:scale-95"
        >
          <span className="material-symbols-outlined text-xl">add</span>
          New Experiment
        </button>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-6 relative overflow-hidden flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-secondary)" }}>Total Tests</p>
            <p className="text-4xl font-extrabold" style={{ color: "var(--text-primary)" }}>{tests.length}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-indigo-500/10 text-indigo-400">
            <span className="material-symbols-outlined text-3xl">science</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card rounded-2xl p-6 relative overflow-hidden flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-secondary)" }}>Running</p>
            <p className="text-4xl font-extrabold text-emerald-400">
              {tests.filter(t => t.status === 'running').length}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center relative">
            <span className="material-symbols-outlined text-3xl">play_circle</span>
            {tests.filter(t => t.status === 'running').length > 0 && (
              <span className="absolute top-3 right-3 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-6 relative overflow-hidden flex items-center justify-between"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-secondary)" }}>Completed</p>
            <p className="text-4xl font-extrabold text-purple-400">
              {tests.filter(t => t.status === 'completed').length}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-purple-500/10 text-purple-400">
            <span className="material-symbols-outlined text-3xl">task_alt</span>
          </div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
        </motion.div>
      </div>

      {/* Tests List */}
      <div className="space-y-6">
        {tests.length === 0 ? (
          <div className="text-center py-20 glass-card rounded-2xl flex flex-col items-center justify-center">
            <div className="p-5 rounded-full bg-indigo-500/5 text-indigo-400 mb-4 border border-indigo-500/10">
              <span className="material-symbols-outlined text-6xl" style={{ opacity: 0.6 }}>science</span>
            </div>
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>No A/B tests running yet</p>
            <p className="text-sm mt-1.5 max-w-sm" style={{ color: "var(--text-secondary)" }}>
              Create different variations of your content to run scientific experiments and let engagement data decide the winner.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-6 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/15"
            >
              Create First Test
            </button>
          </div>
        ) : (
          tests.map((test, index) => {
            const platformConfig = getPlatformConfig(test.platform);
            return (
              <motion.div
                key={test.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card rounded-2xl p-6 hover:shadow-xl hover:shadow-black/5 transition-all duration-300 border relative"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                      {test.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span 
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium" 
                        style={{ background: "var(--bg-hover)", color: platformConfig.color }}
                      >
                        <span className="material-symbols-outlined text-sm">{platformConfig.icon}</span>
                        {platformConfig.label}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold tracking-wide uppercase ${
                        test.status === 'running' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        test.status === 'completed' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                        'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}>
                        {test.status}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {test.status === 'running' && (
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => handleCancel(test.id)}
                        className="px-3.5 py-1.5 rounded-lg border text-sm font-semibold hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all duration-200"
                        style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleEvaluate(test.id)}
                        className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all duration-200 shadow-md shadow-indigo-600/10"
                      >
                        <span className="material-symbols-outlined text-base">analytics</span>
                        Evaluate
                      </button>
                    </div>
                  )}
                </div>

                {/* Variants Preview Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Variant A Card */}
                  <div className="rounded-xl border p-5 flex flex-col h-full bg-black/10" style={{ borderColor: "var(--border-light)" }}>
                    <div className="flex items-center justify-between mb-3.5 pb-2 border-b" style={{ borderColor: "var(--border-light)" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-sm font-bold border border-indigo-500/20">
                          A
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#6366f1" }}>Variant A</span>
                      </div>
                      <span className="material-symbols-outlined text-lg" style={{ color: "var(--text-muted)" }}>chat_bubble</span>
                    </div>
                    {/* Mock Social Media Post */}
                    <div className="flex gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                        AI
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Socialium Creator</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>@creator • Draft</p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed flex-1 whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                      {test.variant_a_id || "Content pending..."}
                    </p>
                  </div>

                  {/* Variant B Card */}
                  <div className="rounded-xl border p-5 flex flex-col h-full bg-black/10" style={{ borderColor: "var(--border-light)" }}>
                    <div className="flex items-center justify-between mb-3.5 pb-2 border-b" style={{ borderColor: "var(--border-light)" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-sm font-bold border border-emerald-500/20">
                          B
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#10b981" }}>Variant B</span>
                      </div>
                      <span className="material-symbols-outlined text-lg" style={{ color: "var(--text-muted)" }}>chat_bubble</span>
                    </div>
                    {/* Mock Social Media Post */}
                    <div className="flex gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-semibold">
                        AI
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Socialium Creator</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>@creator • Draft</p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed flex-1 whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                      {test.variant_b_id || "Content pending..."}
                    </p>
                  </div>
                </div>

                {/* Winner Results Block */}
                {test.winner_variant && (
                  <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                        <span className="material-symbols-outlined text-xl">emoji_events</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-emerald-400">
                          Winner Declared: Variant {test.winner_variant}
                        </p>
                        {test.confidence_score && (
                          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            Evaluated with {test.confidence_score.toFixed(1)}% statistical confidence
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300">
                      Variant {test.winner_variant} is performing better
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl rounded-2xl border shadow-2xl p-6 sm:p-8"
            style={{ 
              background: "var(--bg-secondary)", 
              borderColor: "var(--border-color)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)"
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <span className="material-symbols-outlined text-indigo-400">science</span>
                Create A/B Test
              </h3>
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  setTestName("");
                  setVariantA("");
                  setVariantB("");
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>
                  Experiment Name
                </label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="e.g., Summer Launch Hook Test"
                  className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  style={{
                    background: "var(--bg-hover)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>
                  Social Platform
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as any)}
                  className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200"
                  style={{
                    background: "var(--bg-hover)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="twitter">Twitter / X</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#6366f1" }}>
                  Variant A Content
                </label>
                <textarea
                  value={variantA}
                  onChange={(e) => setVariantA(e.target.value)}
                  placeholder="Enter variant A text (e.g., with a question-based hook)..."
                  rows={4}
                  className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 text-sm leading-relaxed"
                  style={{
                    background: "var(--bg-hover)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#10b981" }}>
                  Variant B Content
                </label>
                <textarea
                  value={variantB}
                  onChange={(e) => setVariantB(e.target.value)}
                  placeholder="Enter variant B text (e.g., with a stat-based hook)..."
                  rows={4}
                  className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 text-sm leading-relaxed"
                  style={{
                    background: "var(--bg-hover)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setTestName("");
                  setVariantA("");
                  setVariantB("");
                }}
                className="flex-1 px-4 py-3 rounded-xl border font-semibold hover:bg-white/5 transition-colors"
                style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTest}
                disabled={creating}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 active:scale-95 shadow-lg shadow-indigo-500/10"
              >
                {creating ? "Creating..." : "Launch Experiment"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
