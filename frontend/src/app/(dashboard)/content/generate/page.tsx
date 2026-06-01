"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getWorkspaceId, fetchAndStoreWorkspace } from "@/lib/workspace";
import { generateContent, createContent, submitForApproval } from "@/services/content";
import toast from "react-hot-toast";

// Tooltip component for AI settings
const InfoTooltip = ({ description }: { description: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block ml-2">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-xs rounded-full w-4 h-4 flex items-center justify-center border"
        style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
      >
        ?
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs shadow-lg min-w-[200px]"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}>
          {description}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="w-2 h-2 rotate-45" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }} />
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to detect input type
function detectInputType(text: string): string {
  if (/^https?:\/\//.test(text)) return "URL";
  if (text.length > 500) return "Long-form Content";
  if (text.includes('\n\n')) return "Article/Notes";
  return "Topic/Short Text";
}

// Helper function to get score color
function getScoreColor(score: number): string {
  if (score >= 8) return "#10b981";  // Green
  if (score >= 6) return "#f59e0b";  // Yellow
  return "#ef4444";  // Red
}

export default function NewContentGeneratorPage() {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string>("");
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

  useEffect(() => {
    setMounted(true);
    const { getWorkspaceId, fetchAndStoreWorkspace } = require("@/lib/workspace");
    const id = getWorkspaceId();
    if (id) {
      setWorkspaceId(id);
    } else {
      fetchAndStoreWorkspace().then((fetchedId: string | null) => {
        if (fetchedId) setWorkspaceId(fetchedId);
      });
    }
  }, []);

  const handleGenerate = async () => {
    console.log('🔍 Debug - workspaceId:', workspaceId);
    console.log('🔍 Debug - topic:', topic);
    
    if (!workspaceId) {
      console.error('❌ No workspace ID! User might not be logged in.');
      toast.error("Workspace is still loading, please wait. Try refreshing the page.");
      return;
    }
    if (!topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }

    console.log('✅ Validation passed, starting generation...');
    setGenerating(true);
    
    // Safety timeout - stop loading after 90 seconds
    const safetyTimeout = setTimeout(() => {
      if (generating) {
        console.error('⏰ Generation timed out after 90 seconds');
        setGenerating(false);
        toast.error("Generation timed out. Please try again.");
      }
    }, 90000);
    
    try {
      // Detect if topic is a URL and route it properly
      const isUrl = topic.trim().match(/^https?:\/\//i);
      
      console.log('🚀 Generating content:', {
        workspaceId,
        topic: isUrl ? 'URL detected' : topic,
        source_url: isUrl ? topic.trim() : undefined,
        platforms: selectedPlatforms,
        tone,
      });
      
      const result = await generateContent({
        workspace_id: workspaceId,
        topic: isUrl ? undefined : topic,
        source_url: isUrl ? topic.trim() : undefined,
        platforms: selectedPlatforms as any,
        tone: tone as any,
        creativity: creativity,
        generate_variants: enableABTesting,
        trend_boost: enableTrendBoost,
        trend_industry: enableTrendBoost ? selectedIndustry : undefined,
      });

      console.log('✅ Content generated successfully:', result);
      setGeneratedContent(result);
      
      // Set first platform as selected
      if (result.platforms && result.platforms.length > 0) {
        setSelectedPlatform(result.platforms[0]);
      }
      
      toast.success("Content generated!");
    } catch (error: any) {
      console.error('❌ Content generation error:', error);
      console.error('Error response:', error?.response);
      console.error('Error data:', error?.response?.data);
      
      let errorMsg = error?.response?.data?.detail || "Failed to generate content";
      if (Array.isArray(errorMsg)) {
        errorMsg = errorMsg.map((err: any) => `${err.loc?.join(".")}: ${err.msg}`).join(", ");
      }
      toast.error(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg));
    } finally {
      clearTimeout(safetyTimeout);
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
    
    // Combine structured fields into complete content
    let fullBody = "";
    if (content.hook) fullBody += content.hook + "\n\n";
    fullBody += content.body;
    if (content.discussion_question) fullBody += "\n\n" + content.discussion_question;
    if (content.engagement_question) fullBody += "\n\n" + content.engagement_question;
    if (content.question) fullBody += "\n\n" + content.question;
    if (content.cta) fullBody += "\n\n" + content.cta;
    
    try {
      const saved = await createContent({
        workspace_id: workspaceId,
        platform: selectedPlatform as any,
        tone: tone as any,
        title: content.title || `${selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} Post`,
        body: fullBody.trim(),
        hashtags: content.hashtags,
      });

      toast.success("Draft saved!");
      router.push(`/content/${saved.id}`);
    } catch (error: any) {
      let errorMsg = error?.response?.data?.detail || "Failed to save draft";
      if (Array.isArray(errorMsg)) {
        errorMsg = errorMsg.map((err: any) => `${err.loc?.join(".")}: ${err.msg}`).join(", ");
      }
      toast.error(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAllPlatforms = async () => {
    if (!generatedContent?.results) {
      toast.error("No content to save");
      return;
    }

    const platforms = Object.keys(generatedContent.results).filter(
      (p) => generatedContent.results[p]?.success
    );

    if (platforms.length === 0) {
      toast.error("No successful platforms to save");
      return;
    }

    setSaving(true);
    let saved = 0;
    let failed = 0;

    for (const platform of platforms) {
      const content = generatedContent.results[platform];
      
      // Combine structured fields into complete content
      let fullBody = "";
      if (content.hook) fullBody += content.hook + "\n\n";
      fullBody += content.body;
      if (content.discussion_question) fullBody += "\n\n" + content.discussion_question;
      if (content.engagement_question) fullBody += "\n\n" + content.engagement_question;
      if (content.question) fullBody += "\n\n" + content.question;
      if (content.cta) fullBody += "\n\n" + content.cta;
      
      try {
        await createContent({
          workspace_id: workspaceId,
          platform: platform as any,
          tone: tone as any,
          title: content.title || `${platform.charAt(0).toUpperCase() + platform.slice(1)} Post`,
          body: fullBody.trim(),
          hashtags: content.hashtags,
        });
        saved++;
      } catch {
        failed++;
      }
    }

    setSaving(false);
    if (failed === 0) {
      toast.success(`✅ Saved ${saved} platform${saved > 1 ? "s" : ""} as drafts!`);
      router.push("/content");
    } else {
      toast.success(`Saved ${saved}, failed ${failed}`);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!generatedContent?.results?.[selectedPlatform]) {
      toast.error("No content to submit");
      return;
    }

    setSaving(true);
    const content = generatedContent.results[selectedPlatform];
    
    // Combine structured fields into complete content
    let fullBody = "";
    if (content.hook) fullBody += content.hook + "\n\n";
    fullBody += content.body;
    if (content.discussion_question) fullBody += "\n\n" + content.discussion_question;
    if (content.engagement_question) fullBody += "\n\n" + content.engagement_question;
    if (content.question) fullBody += "\n\n" + content.question;
    if (content.cta) fullBody += "\n\n" + content.cta;
    
    try {
      // First save the content
      const saved = await createContent({
        workspace_id: workspaceId,
        platform: selectedPlatform as any,
        tone: tone as any,
        title: content.title || `${selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} Post`,
        body: fullBody.trim(),
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
      let errorMsg = error?.response?.data?.detail || "Failed to submit for approval";
      if (Array.isArray(errorMsg)) {
        errorMsg = errorMsg.map((err: any) => `${err.loc?.join(".")}: ${err.msg}`).join(", ");
      }
      toast.error(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg));
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
          {/* Content Source - Single Smart Field */}
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              Content Source
            </label>
            <textarea
              className="w-full h-40 border rounded-xl p-4 text-base focus:outline-none transition-colors placeholder:opacity-40"
              style={{ background: "var(--bg-hover)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
              placeholder="Paste a topic, blog URL, article, transcript, notes, or any text..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            {/* Auto-detected type indicator */}
            {topic && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                <span>Detected: {detectInputType(topic)}</span>
              </div>
            )}
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
              <option value="thought_leadership">Thought Leadership</option>
              <option value="educational">Educational</option>
              <option value="storytelling">Storytelling</option>
              <option value="humorous">Humorous</option>
              <option value="persuasive">Persuasive</option>
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
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>A/B Testing</span>
                  <InfoTooltip description="Generate multiple content variations and recommend the highest-performing version." />
                </div>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Generate multiple variants for testing</span>
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
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Trend Boost</span>
                  <InfoTooltip description="Incorporate trending topics related to the content using Google, LinkedIn, and Reddit trends." />
                </div>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Incorporate trending topics from Google, LinkedIn & Reddit</span>
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
            disabled={generating || !topic.trim()}
            className="w-full text-white py-4 px-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
              boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)"
            }}
          >
            {generating ? (
              <>
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                Generating AI Content...
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
              <div className="flex gap-2 mt-2 flex-wrap">
                <button
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="flex-1 min-w-[120px] max-w-[200px] rounded-lg py-2.5 px-3 text-sm font-medium border hover:bg-opacity-80 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-primary)", background: "var(--bg-card)" }}
                >
                  <span className="material-symbols-outlined text-[16px]">{saving ? "progress_activity" : "save"}</span>
                  {saving ? "Saving..." : "Save Draft"}
                </button>

                {/* Show "Save All" only when multiple platforms generated */}
                {generatedContent?.platforms && generatedContent.platforms.length > 1 && (
                  <button
                    onClick={handleSaveAllPlatforms}
                    disabled={saving}
                    className="flex-1 min-w-[120px] max-w-[200px] rounded-lg py-2.5 px-3 text-sm font-medium border hover:bg-opacity-80 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    style={{ borderColor: "#6366f1", color: "#6366f1", background: "rgba(99,102,241,0.08)" }}
                  >
                    <span className="material-symbols-outlined text-[16px]">save_all</span>
                    {saving ? "Saving..." : `Save All (${generatedContent.platforms.length})`}
                  </button>
                )}
                
                <button
                  onClick={handleSubmitForApproval}
                  disabled={saving}
                  className="flex-1 min-w-[140px] max-w-[220px] rounded-lg py-2.5 px-3 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">{saving ? "progress_activity" : "send"}</span>
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
              <div className="space-y-6">
                {/* Trend Boost Display */}
                {generatedContent.trends_used && generatedContent.trends_used.length > 0 && (
                  <div className="rounded-xl border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="material-symbols-outlined text-sm" style={{ color: "#f59e0b" }}>trending_up</span>
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        Trends Incorporated
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {generatedContent.trends_used.map((trend: string, idx: number) => (
                        <span key={idx} className="px-3 py-1 rounded-full text-xs" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                          {trend}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* A/B Test Results */}
                {generatedContent.ab_test_recommendation && (
                  <div className="rounded-xl border p-6" style={{ background: "var(--bg-card)", borderColor: "#6366f1" }}>
                    <h4 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>
                      A/B Test Results
                    </h4>
                    
                    <div className="grid gap-4">
                      {Object.entries(generatedContent.results)
                        .filter(([_, data]: [string, any]) => data.variant_id || _.includes('variant'))
                        .map(([key, data]: [string, any]) => (
                          <div key={key} className={`p-4 rounded-lg border-2 ${
                            generatedContent.ab_test_recommendation.best_variant === key
                              ? "border-indigo-500"
                              : "border-transparent"
                          }`} style={{ background: "var(--bg-hover)" }}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{data.variant_id || key}</span>
                              {generatedContent.ab_test_recommendation.best_variant === key && (
                                <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "#6366f1", color: "white" }}>
                                  RECOMMENDED
                                </span>
                              )}
                            </div>
                            <p className="text-sm mb-2" style={{ color: "var(--text-primary)" }}>{data.body}</p>
                            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                              <span>Score: {data.quality_score || 0}/10</span>
                            </div>
                          </div>
                        ))}
                    </div>
                    
                    <div className="mt-4 p-3 rounded-lg" style={{ background: "rgba(99,102,241,0.08)" }}>
                      <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                        <strong>Recommendation:</strong> {generatedContent.ab_test_recommendation.reasoning}
                      </p>
                    </div>
                  </div>
                )}

                {/* Platform Content Card */}
                {generatedContent.results[selectedPlatform] && (
                  <div className="rounded-xl border p-6" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
                    {/* Hook Section */}
                    {generatedContent.results[selectedPlatform].hook && (
                      <div className="mb-4">
                        <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: "var(--text-muted)" }}>
                          Hook / Headline
                        </label>
                        <div className="p-3 rounded-lg font-semibold text-lg" style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}>
                          {generatedContent.results[selectedPlatform].hook}
                        </div>
                      </div>
                    )}
                    
                    {/* Main Content */}
                    <div className="mb-4">
                      <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: "var(--text-muted)" }}>
                        Main Content
                      </label>
                      <div className="p-4 rounded-lg whitespace-pre-wrap" style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}>
                        {generatedContent.results[selectedPlatform].body}
                      </div>
                      <div className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                        {generatedContent.results[selectedPlatform].char_count || generatedContent.results[selectedPlatform].body.length} characters
                      </div>
                    </div>
                    
                    {/* Discussion Question (LinkedIn) */}
                    {generatedContent.results[selectedPlatform].discussion_question && (
                      <div className="mb-4 p-3 rounded-lg border-l-4" style={{ background: "var(--bg-hover)", borderColor: "#6366f1" }}>
                        <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>
                          Discussion Question
                        </label>
                        <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {generatedContent.results[selectedPlatform].discussion_question}
                        </p>
                      </div>
                    )}

                    {/* Engagement Question (Twitter) */}
                    {generatedContent.results[selectedPlatform].engagement_question && (
                      <div className="mb-4 p-3 rounded-lg border-l-4" style={{ background: "var(--bg-hover)", borderColor: "#6366f1" }}>
                        <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>
                          Engagement Question
                        </label>
                        <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {generatedContent.results[selectedPlatform].engagement_question}
                        </p>
                      </div>
                    )}

                    {/* Question (Facebook) */}
                    {generatedContent.results[selectedPlatform].question && (
                      <div className="mb-4 p-3 rounded-lg border-l-4" style={{ background: "var(--bg-hover)", borderColor: "#6366f1" }}>
                        <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>
                          Question
                        </label>
                        <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {generatedContent.results[selectedPlatform].question}
                        </p>
                      </div>
                    )}
                    
                    {/* CTA */}
                    {generatedContent.results[selectedPlatform].cta && (
                      <div className="mb-4 p-3 rounded-lg" style={{ background: "rgba(99,102,241,0.08)" }}>
                        <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "var(--text-muted)" }}>
                          Call-to-Action
                        </label>
                        <p className="font-medium" style={{ color: "#6366f1" }}>
                          {generatedContent.results[selectedPlatform].cta}
                        </p>
                      </div>
                    )}
                    
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
                      <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
                        <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Virality Score:</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
                            <div className="h-full rounded-full" style={{ width: `${generatedContent.results[selectedPlatform].quality_score * 10}%`, background: getScoreColor(generatedContent.results[selectedPlatform].quality_score) }} />
                          </div>
                          <span className="text-lg font-bold" style={{ color: getScoreColor(generatedContent.results[selectedPlatform].quality_score) }}>
                            {generatedContent.results[selectedPlatform].quality_score}/10
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
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
