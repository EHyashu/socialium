"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { requireWorkspaceId } from "@/lib/workspace";
import { listABTests, createABTest, evaluateABTest } from "@/services/ab-testing";
import type { ABTest } from "@/types";
import toast from "react-hot-toast";

export default function ABTestingPage() {
  const workspaceId = requireWorkspaceId();
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
    loadTests();
  }, []);

  const loadTests = async () => {
    try {
      const data = await listABTests(workspaceId);
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            A/B Testing
          </h1>
          <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
            Test different content variations to optimize engagement
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          <span className="material-symbols-outlined">add</span>
          New Test
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-6"
        >
          <p className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Total Tests</p>
          <p className="text-4xl font-bold" style={{ color: "var(--text-primary)" }}>{tests.length}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl p-6"
        >
          <p className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Running</p>
          <p className="text-4xl font-bold" style={{ color: "#10b981" }}>
            {tests.filter(t => t.status === 'running').length}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl p-6"
        >
          <p className="text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Completed</p>
          <p className="text-4xl font-bold" style={{ color: "#6366f1" }}>
            {tests.filter(t => t.status === 'completed').length}
          </p>
        </motion.div>
      </div>

      {/* Tests List */}
      <div className="space-y-4">
        {tests.length === 0 ? (
          <div className="text-center py-16 glass-card rounded-xl">
            <span className="material-symbols-outlined text-6xl mb-4" style={{ color: "var(--text-secondary)", opacity: 0.3 }}>
              science
            </span>
            <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>No A/B tests yet</p>
            <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
              Create your first test to optimize content performance
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Create Test
            </button>
          </div>
        ) : (
          tests.map((test, index) => (
            <motion.div
              key={test.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                    {test.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-1 rounded capitalize" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                      {test.platform}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      test.status === 'running' ? 'bg-green-500/20 text-green-400' :
                      test.status === 'completed' ? 'bg-indigo-500/20 text-indigo-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {test.status}
                    </span>
                  </div>
                </div>
                {test.status === 'running' && (
                  <button
                    onClick={() => handleEvaluate(test.id)}
                    className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition-colors"
                  >
                    Evaluate
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg" style={{ background: "var(--bg-hover)" }}>
                  <p className="text-xs font-bold mb-2 uppercase" style={{ color: "#6366f1" }}>Variant A</p>
                  <p className="text-sm line-clamp-3" style={{ color: "var(--text-secondary)" }}>
                    {test.variant_a_id || "Content pending..."}
                  </p>
                </div>
                <div className="p-4 rounded-lg" style={{ background: "var(--bg-hover)" }}>
                  <p className="text-xs font-bold mb-2 uppercase" style={{ color: "#10b981" }}>Variant B</p>
                  <p className="text-sm line-clamp-3" style={{ color: "var(--text-secondary)" }}>
                    {test.variant_b_id || "Content pending..."}
                  </p>
                </div>
              </div>

              {test.winner_variant && (
                <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-sm font-medium" style={{ color: "#10b981" }}>
                    ✓ Winner: Variant {test.winner_variant}
                    {test.confidence_score && ` (${test.confidence_score.toFixed(1)}% confidence)`}
                  </p>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl rounded-xl border shadow-2xl p-6"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          >
            <h3 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
              Create A/B Test
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                  Test Name
                </label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="e.g., Hook Style Test"
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none"
                  style={{
                    background: "var(--bg-hover)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                  Platform
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as any)}
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none"
                  style={{
                    background: "var(--bg-hover)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="twitter">Twitter</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#6366f1" }}>
                  Variant A
                </label>
                <textarea
                  value={variantA}
                  onChange={(e) => setVariantA(e.target.value)}
                  placeholder="Enter content for variant A..."
                  rows={4}
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none"
                  style={{
                    background: "var(--bg-hover)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#10b981" }}>
                  Variant B
                </label>
                <textarea
                  value={variantB}
                  onChange={(e) => setVariantB(e.target.value)}
                  placeholder="Enter content for variant B..."
                  rows={4}
                  className="w-full border rounded-lg px-4 py-2 focus:outline-none"
                  style={{
                    background: "var(--bg-hover)",
                    borderColor: "var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setTestName("");
                  setVariantA("");
                  setVariantB("");
                }}
                className="flex-1 px-4 py-2 rounded-lg border hover:bg-white/10 transition-colors"
                style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTest}
                disabled={creating}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Test"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
