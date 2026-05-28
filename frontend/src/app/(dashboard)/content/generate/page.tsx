"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requireWorkspaceId } from "@/lib/workspace";
import { generateContent, createContent, submitForApproval } from "@/services/content";
import toast from "react-hot-toast";

export default function NewContentGeneratorPage() {
  const router = useRouter();
  const workspaceId = requireWorkspaceId();
  const [mounted, setMounted] = useState(false);
  const [topic, setTopic] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["linkedin", "twitter"]);
  const [tone, setTone] = useState("professional");
  const [creativity, setCreativity] = useState(50);
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("linkedin");
  const [saving, setSaving] = useState(false);
  
  // New AI settings
  const [enableABTesting, setEnableABTesting] = useState(false);
  const [enableTrendBoost, setEnableTrendBoost] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState("technology");
  
  // Tooltip states
  const [showABTooltip, setShowABTooltip] = useState(false);
  const [showTrendTooltip, setShowTrendTooltip] = useState(false);
  const [showViralTooltip, setShowViralTooltip] = useState(false);
  const [showNotificationsTooltip, setShowNotificationsTooltip] = useState(false);
  const [showBillingTooltip, setShowBillingTooltip] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }

    setGenerating(true);
    try {
      const result = await generateContent({
        workspace_id: workspaceId,
        topic,
        platforms: selectedPlatforms as any,
        tone: tone as any,
        creativity: creativity,
        generate_variants: enableABTesting,
        trend_boost: enableTrendBoost,
        trend_industry: enableTrendBoost ? selectedIndustry : undefined,
      });

      setGeneratedContent(result);
      
      // Set first platform as selected
      if (result.platforms && result.platforms.length > 0) {
        setSelectedPlatform(result.platforms[0]);
      }
      
      toast.success("Content generated!");
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || "Failed to generate content";
      toast.error(errorMsg);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!generatedContent?.results?.[selectedPlatform]) {
      toast.error("No content to save");
      return;
    }

    setSaving(true);
    const content = generatedContent.results[selectedPlatform];
    
    try {
      const saved = await createContent({
        workspace_id: workspaceId,
        platform: selectedPlatform as any,
        tone: tone as any,
        title: content.title,
        body: content.body,
        hashtags: content.hashtags,
      });

      toast.success("Draft saved!");
      router.push(`/content/${saved.id}`);
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || "Failed to save draft";
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!generatedContent?.results?.[selectedPlatform]) {
      toast.error("No content to submit");
      return;
    }

    setSaving(true);
    const content = generatedContent.results[selectedPlatform];
    
    try {
      // First save the content
      const saved = await createContent({
        workspace_id: workspaceId,
        platform: selectedPlatform as any,
        tone: tone as any,
        title: content.title,
        body: content.body,
        hashtags: content.hashtags,
      });

      // Then submit for approval
      const result = await submitForApproval(saved.id);
      
      if (result.whatsapp_sent) {
        toast.success("Submitted! WhatsApp notification sent");
      } else {
        toast.success("Submitted for approval" + (result.reason ? ` - ${result.reason}` : ""));
      }
      
      router.push("/approvals");
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || "Failed to submit for approval";
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <span className="material-symbols-outlined text-4xl animate-spin" style={{ color: "#6366f1" }}>progress_activity</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 flex justify-between items-center w-full px-6 py-3 border-b" style={{ background: "var(--bg-secondary)/80", borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-4">
          <Link href="/content" className="hover:opacity-80 transition-colors" style={{ color: "var(--text-secondary)" }}>
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Content Lab</h2>
          <div className="hidden md:flex gap-4">
            <button className="font-bold pb-1" style={{ color: "#6366f1", borderBottom: "2px solid #6366f1" }}>
              Generator
            </button>
            <button className="font-medium hover:opacity-80 transition-colors" style={{ color: "var(--text-secondary)" }}>
              Templates
            </button>
            <button className="font-medium hover:opacity-80 transition-colors" style={{ color: "var(--text-secondary)" }}>
              Archive
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex rounded-full px-4 py-1 items-center gap-2 border" style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)" }}>
            <span className="material-symbols-outlined text-[18px]" style={{ color: "#6366f1", fontVariationSettings: "'FILL' 1" }}>bolt</span>
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>1,240 Credits</span>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            <span className="text-sm font-bold text-white">U</span>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
        {/* Left Input Panel */}
        <section className="w-full lg:w-[40%] border-r flex flex-col overflow-y-auto p-6 gap-6" style={{ borderColor: "var(--border-color)" }}>
          {/* Source Tabs */}
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              Input Source
            </label>
            <div className="flex rounded-xl p-1 gap-1" style={{ background: "var(--bg-hover)" }}>
              <button className="flex-1 py-2 text-sm flex items-center justify-center gap-1" style={{ background: "var(--bg-card)", color: "#6366f1", borderRadius: "0.5rem" }}>
                <span className="material-symbols-outlined text-[18px]">topic</span>
                Topic
              </button>
              <button className="flex-1 py-2 hover:opacity-80 text-sm rounded-lg flex items-center justify-center gap-1 transition-colors" style={{ color: "var(--text-secondary)" }}>
                <span className="material-symbols-outlined text-[18px]">rss_feed</span>
                Blog URL
              </button>
              <button className="flex-1 py-2 hover:opacity-80 text-sm rounded-lg flex items-center justify-center gap-1 transition-colors" style={{ color: "var(--text-secondary)" }}>
                <span className="material-symbols-outlined text-[18px]">content_paste</span>
                Paste
              </button>
            </div>
            <textarea
              className="w-full h-32 border rounded-xl p-4 text-base focus:outline-none transition-colors placeholder:opacity-40"
              style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              placeholder="Describe your topic or paste raw notes here..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          {/* Platform Multi-select */}
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              Target Platforms
            </label>
            <div className="grid grid-cols-2 gap-2">
              {["linkedin", "twitter", "instagram", "facebook"].map((platform) => (
                <label
                  key={platform}
                  className={`rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-colors border ${
                    selectedPlatforms.includes(platform)
                      ? "border-indigo-400" 
                      : "hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                  style={{ background: selectedPlatforms.includes(platform) ? "var(--bg-hover)" : "var(--bg-card)", borderColor: selectedPlatforms.includes(platform) ? "#6366f1" : "var(--border-color)" }}
                >
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(platform)}
                    onChange={() => togglePlatform(platform)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-0"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold capitalize" style={{ color: "var(--text-primary)" }}>
                      {platform === "twitter" ? "Twitter (X)" : platform}
                    </span>
                    <span className="text-[10px] opacity-60" style={{ color: "var(--text-secondary)" }}>
                      {platform === "linkedin" && "Professional Tone"}
                      {platform === "twitter" && "Thread & Short"}
                      {platform === "instagram" && "Visual & Hashtags"}
                      {platform === "facebook" && "Long-form Posts"}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* AI Settings */}
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              Tone & Style
            </label>
            <select
              className="border rounded-xl p-4 text-base focus:outline-none"
              style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="humorous">Humorous</option>
              <option value="inspirational">Inspirational</option>
              <option value="educational">Educational</option>
            </select>
          </div>

          {/* Creativity Slider */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                Creativity Level
              </label>
              <span className="text-sm font-bold" style={{ color: "#6366f1" }}>{creativity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={creativity}
              onChange={(e) => setCreativity(Number(e.target.value))}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={{ background: "var(--bg-hover)" }}
            />
          </div>

          {/* AI Advanced Settings */}
          <div className="flex flex-col gap-3">
            <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              AI Advanced Settings
            </label>
            
            {/* A/B Testing Toggle */}
            <div className="flex items-center justify-between rounded-xl p-4 border" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>A/B Testing</span>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Generate multiple variants for testing</span>
                </div>
                <div className="relative">
                  <button
                    onMouseEnter={() => setShowABTooltip(true)}
                    onMouseLeave={() => setShowABTooltip(false)}
                    onClick={() => setShowABTooltip(!showABTooltip)}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                    style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
                  >
                    i
                  </button>
                  <AnimatePresence>
                    {showABTooltip && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute left-0 bottom-full mb-2 w-64 p-3 rounded-lg shadow-lg z-50"
                        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
                      >
                        <p className="text-xs" style={{ color: "var(--text-primary)" }}>
                          <strong>A/B Testing</strong> creates 2-3 different versions of your content so you can test which performs better. The system will track engagement metrics and automatically learn which style works best for your audience.
                        </p>
                        <div className="absolute left-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent" style={{ borderTopColor: "var(--border-color)" }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <button
                onClick={() => setEnableABTesting(!enableABTesting)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  enableABTesting ? "bg-indigo-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    enableABTesting ? "translate-x-6" : ""
                  }`}
                />
              </button>
            </div>

            {/* Trend Boost Toggle */}
            <div className="flex items-center justify-between rounded-xl p-4 border" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Trend Boost</span>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Incorporate trending topics from Google, LinkedIn & Reddit</span>
                </div>
                <div className="relative">
                  <button
                    onMouseEnter={() => setShowTrendTooltip(true)}
                    onMouseLeave={() => setShowTrendTooltip(false)}
                    onClick={() => setShowTrendTooltip(!showTrendTooltip)}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                    style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
                  >
                    i
                  </button>
                  <AnimatePresence>
                    {showTrendTooltip && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute left-0 bottom-full mb-2 w-64 p-3 rounded-lg shadow-lg z-50"
                        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
                      >
                        <p className="text-xs" style={{ color: "var(--text-primary)" }}>
                          <strong>Trend Boost</strong> analyzes real-time trending topics from Google Trends, LinkedIn, and Reddit in your industry. It then intelligently incorporates these trends into your content to maximize reach and engagement.
                        </p>
                        <div className="absolute left-2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent" style={{ borderTopColor: "var(--border-color)" }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <button
                onClick={() => setEnableTrendBoost(!enableTrendBoost)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  enableTrendBoost ? "bg-indigo-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    enableTrendBoost ? "translate-x-6" : ""
                  }`}
                />
              </button>
            </div>

            {/* Industry Selection (only when trend boost is enabled) */}
            {enableTrendBoost && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Industry for Trend Detection
                </label>
                <select
                  className="border rounded-xl p-3 text-sm focus:outline-none"
                  style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                >
                  <option value="technology">Technology</option>
                  <option value="marketing">Marketing</option>
                  <option value="finance">Finance</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="education">Education</option>
                  <option value="ecommerce">E-commerce</option>
                  <option value="entertainment">Entertainment</option>
                </select>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGenerate}
            disabled={generating}
            className="w-full text-white py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
              boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)"
            }}
          >
            {generating ? (
              <>
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                Generating...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">auto_awesome</span>
                Generate Content
              </>
            )}
          </motion.button>
        </section>

        {/* Right Output Panel */}
        <section className="w-full lg:w-[60%] flex flex-col overflow-y-auto p-6 gap-6">
          {generatedContent && generatedContent.results ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Generated Content</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const content = generatedContent.results[selectedPlatform];
                      if (content) {
                        navigator.clipboard.writeText(content.body);
                        toast.success("Copied to clipboard!");
                      }
                    }}
                    className="rounded-lg px-4 py-2 text-sm flex items-center gap-1 hover:opacity-80 transition-colors border"
                    style={{ color: "var(--text-primary)", background: "var(--bg-card)", borderColor: "var(--border-color)" }}
                  >
                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                    Copy
                  </button>
                  <button
                    onClick={handleGenerate}
                    className="rounded-lg px-4 py-2 text-sm flex items-center gap-1 hover:opacity-80 transition-colors border"
                    style={{ color: "var(--text-primary)", background: "var(--bg-card)", borderColor: "var(--border-color)" }}
                  >
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                    Regenerate
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-2">
                <button
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="flex-1 rounded-lg py-3 px-4 font-medium border hover:bg-opacity-80 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", background: "var(--bg-card)" }}
                >
                  <span className="material-symbols-outlined text-sm">{saving ? "progress_activity" : "save"}</span>
                  {saving ? "Saving..." : "Save as Draft"}
                </button>
                
                <button
                  onClick={handleSubmitForApproval}
                  disabled={saving}
                  className="flex-1 rounded-lg py-3 px-4 font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">{saving ? "progress_activity" : "send"}</span>
                  {saving ? "Submitting..." : "Submit for Approval"}
                </button>
              </div>

              {/* Platform Tabs */}
              {generatedContent.platforms && generatedContent.platforms.length > 1 && (
                <div className="flex gap-2">
                  {generatedContent.platforms.map((platform: string) => (
                    <button
                      key={platform}
                      onClick={() => setSelectedPlatform(platform)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                        selectedPlatform === platform
                          ? "bg-indigo-600 text-white"
                          : "border hover:opacity-80"
                      }`}
                      style={selectedPlatform !== platform ? { borderColor: "var(--border-color)", color: "var(--text-primary)", background: "var(--bg-card)" } : {}}
                    >
                      {platform === "twitter" ? "Twitter (X)" : platform}
                    </button>
                  ))}
                </div>
              )}

              {/* Content Display */}
              <div className="rounded-xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
                {generatedContent.results[selectedPlatform] ? (
                  <div className="space-y-4">
                    <h4 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                      {generatedContent.results[selectedPlatform].title}
                    </h4>
                    <div className="prose max-w-none" style={{ color: "var(--text-primary)" }}>
                      {generatedContent.results[selectedPlatform].body}
                    </div>
                    
                    {/* Hashtags */}
                    {generatedContent.results[selectedPlatform].hashtags && generatedContent.results[selectedPlatform].hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
                        {generatedContent.results[selectedPlatform].hashtags.map((tag: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-full text-sm"
                            style={{ background: "var(--bg-hover)", color: "#6366f1" }}
                          >
                            #{tag.replace(/^#/, '')}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Quality Score */}
                    {generatedContent.results[selectedPlatform].quality_score && (
                      <div className="flex items-center gap-2 pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
                        <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Quality Score:</span>
                        <span className="text-lg font-bold" style={{ color: "#6366f1" }}>
                          {generatedContent.results[selectedPlatform].quality_score}/10
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ color: "var(--text-secondary)" }}>No content for this platform</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <span className="material-symbols-outlined text-6xl mb-4" style={{ color: "var(--text-muted)" }}>auto_awesome</span>
                <h3 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Ready to Create</h3>
                <p style={{ color: "var(--text-secondary)" }}>Enter a topic and click Generate Content</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
