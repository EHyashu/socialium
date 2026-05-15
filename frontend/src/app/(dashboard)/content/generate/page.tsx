"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowLeft,
  Copy,
  Check,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Flame,
  Linkedin,
  Twitter,
  Instagram,
  Facebook,
  Calendar,
} from "lucide-react";
import { generateContent, createContent } from "@/services/content";
import { fetchTrendingKeywords, type TrendKeyword } from "@/services/trends";
import { getStoredUser } from "@/lib/auth";
import type { Platform, ContentTone, PlatformResult } from "@/types";
import toast from "react-hot-toast";

/* ===== Constants ===== */
const PLATFORMS: { value: Platform; label: string; color: string; bg: string; border: string; charLimit: number }[] = [
  { value: "linkedin", label: "LinkedIn", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-500", charLimit: 3000 },
  { value: "twitter", label: "Twitter / X", color: "text-gray-900", bg: "bg-gray-50", border: "border-gray-800", charLimit: 280 },
  { value: "instagram", label: "Instagram", color: "text-pink-600", bg: "bg-pink-50", border: "border-pink-500", charLimit: 2200 },
  { value: "facebook", label: "Facebook", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-600", charLimit: 63206 },
];

const TONES: { value: ContentTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "humorous", label: "Humorous" },
  { value: "inspirational", label: "Inspirational" },
  { value: "educational", label: "Educational" },
  { value: "promotional", label: "Promotional" },
];

const INDUSTRIES = ["Technology", "Marketing", "Business", "Finance", "Health", "Education", "Other"];

type SourceTab = "topic" | "url" | "paste";

export default function GenerateContentPage() {
  const router = useRouter();
  const user = getStoredUser();
  const workspaceId = user?.id || "00000000-0000-0000-0000-000000000000";

  // Source
  const [sourceTab, setSourceTab] = useState<SourceTab>("topic");
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [audience, setAudience] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [pasteText, setPasteText] = useState("");

  // Platforms (multi-select)
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["linkedin", "twitter", "instagram", "facebook"]);

  // AI Settings
  const [showSettings, setShowSettings] = useState(false);
  const [tone, setTone] = useState<ContentTone>("professional");
  const [creativity, setCreativity] = useState(50);
  const [contentLength, setContentLength] = useState<"short" | "medium" | "long">("medium");
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [generateVariants, setGenerateVariants] = useState(false);

  // Trend Boost
  const [trendBoost, setTrendBoost] = useState(false);
  const [trendIndustry, setTrendIndustry] = useState("Technology");
  const [trendKeywords, setTrendKeywords] = useState<TrendKeyword[]>([]);
  const [selectedTrendKeywords, setSelectedTrendKeywords] = useState<string[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatingPlatform, setGeneratingPlatform] = useState<string>("");
  const [results, setResults] = useState<Record<string, PlatformResult> | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [copiedPlatform, setCopiedPlatform] = useState<string>("");

  // Fetch trends when boost enabled or industry changes
  useEffect(() => {
    if (!trendBoost) return;
    setLoadingTrends(true);
    fetchTrendingKeywords(trendIndustry)
      .then(setTrendKeywords)
      .catch(() => setTrendKeywords([]))
      .finally(() => setLoadingTrends(false));
  }, [trendBoost, trendIndustry]);

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const toggleTrendKeyword = (kw: string) => {
    setSelectedTrendKeywords((prev) =>
      prev.includes(kw) ? prev.filter((x) => x !== kw) : [...prev, kw]
    );
  };

  const getSourceContent = () => {
    if (sourceTab === "topic") return topic.trim();
    if (sourceTab === "url") return sourceUrl.trim();
    return pasteText.trim();
  };

  const handleGenerate = async () => {
    const source = getSourceContent();
    if (!source) {
      toast.error("Please provide content source");
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }

    setGenerating(true);
    setResults(null);
    setGeneratingPlatform(selectedPlatforms[0]);

    try {
      const allKeywords = [
        ...keywords.split(",").map((k) => k.trim()).filter(Boolean),
        ...selectedTrendKeywords,
      ];

      const data = await generateContent({
        workspace_id: workspaceId,
        platforms: selectedPlatforms,
        tone,
        topic: sourceTab === "topic" ? source : undefined,
        source_text: sourceTab === "paste" ? source : undefined,
        source_url: sourceTab === "url" ? source : undefined,
        keywords: allKeywords.length > 0 ? allKeywords : undefined,
        target_audience: audience || undefined,
        creativity,
        content_length: contentLength,
        include_hashtags: includeHashtags,
        include_emojis: includeEmojis,
        generate_variants: generateVariants,
        trend_boost: trendBoost,
        trend_industry: trendBoost ? trendIndustry : undefined,
        trend_keywords: selectedTrendKeywords.length > 0 ? selectedTrendKeywords : undefined,
      });

      setResults(data.results);
      setActiveTab(selectedPlatforms[0]);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      let msg = "Generation failed. Check your API key.";
      if (typeof detail === "string") msg = detail;
      else if (Array.isArray(detail)) msg = detail.map((e: any) => e.msg || JSON.stringify(e)).join("; ");
      toast.error(msg);
    } finally {
      setGenerating(false);
      setGeneratingPlatform("");
    }
  };

  const handleCopy = async (platform: string) => {
    const r = results?.[platform];
    if (!r) return;
    const text = [r.body, r.hashtags?.length ? r.hashtags.map((h) => `#${h}`).join(" ") : ""].filter(Boolean).join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopiedPlatform(platform);
    toast.success("Copied!");
    setTimeout(() => setCopiedPlatform(""), 2000);
  };

  const handleSaveAll = async () => {
    if (!results) return;
    try {
      for (const [platform, r] of Object.entries(results)) {
        if (!r.success || platform.includes("_variant")) continue;
        await createContent({
          workspace_id: workspaceId,
          platform: platform as Platform,
          tone,
          title: topic.trim().slice(0, 80) || "AI Generated",
          body: r.body,
          hashtags: r.hashtags,
        });
      }
      toast.success("All saved as drafts!");
      router.push("/content");
    } catch {
      toast.error("Failed to save");
    }
  };

  const getPlatformIcon = (p: string) => {
    switch (p) {
      case "linkedin": return <Linkedin className="h-4 w-4" />;
      case "twitter": return <Twitter className="h-4 w-4" />;
      case "instagram": return <Instagram className="h-4 w-4" />;
      case "facebook": return <Facebook className="h-4 w-4" />;
      default: return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600 bg-green-100";
    if (score >= 6) return "text-amber-600 bg-amber-100";
    return "text-red-600 bg-red-100";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/content")}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Content Generator</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate platform-optimized content with AI-powered insights</p>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT PANEL — Input configuration */}
        <div className="lg:col-span-2 space-y-4">
          {/* Section 1: Content Source */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Content Source</h3>
            <div className="flex border-b border-gray-200 mb-4">
              {(["topic", "url", "paste"] as SourceTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSourceTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    sourceTab === tab
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "topic" ? "Topic" : tab === "url" ? "Blog URL" : "Paste Text"}
                </button>
              ))}
            </div>

            {sourceTab === "topic" && (
              <div className="space-y-3">
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={4}
                  placeholder="What do you want to post about?"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Keywords (comma-separated, optional)"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Target audience (e.g. startup founders, marketers)"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {sourceTab === "url" && (
              <div className="space-y-3">
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://yourblog.com/article..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400">Paste a blog URL and we&apos;ll extract key points for content generation</p>
              </div>
            )}

            {sourceTab === "paste" && (
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={8}
                placeholder="Paste any raw text — article, notes, transcript..."
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            )}
          </div>

          {/* Section 2: Platforms (multi-select) */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Platforms</h3>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map((p) => {
                const selected = selectedPlatforms.includes(p.value);
                return (
                  <button
                    key={p.value}
                    onClick={() => togglePlatform(p.value)}
                    className={`relative flex items-center gap-2 rounded-lg border-2 px-3 py-3 text-left text-sm font-medium transition-all ${
                      selected
                        ? `${p.border} ${p.bg} ${p.color}`
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {getPlatformIcon(p.value)}
                    <div>
                      <p className="text-xs font-semibold">{p.label}</p>
                      <p className="text-[10px] text-gray-400">{p.charLimit.toLocaleString()} chars</p>
                    </div>
                    {selected && (
                      <Check className="absolute top-2 right-2 h-3.5 w-3.5 text-green-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: AI Settings (collapsible) */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900"
            >
              AI Settings
              {showSettings ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>
            {showSettings && (
              <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                {/* Tone */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-2 block">Tone</label>
                  <div className="flex flex-wrap gap-1.5">
                    {TONES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTone(t.value)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          tone === t.value
                            ? "bg-purple-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Creativity slider */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-gray-600">Creativity</label>
                    <span className="text-xs text-gray-400">{creativity}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={creativity}
                    onChange={(e) => setCreativity(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>Conservative</span>
                    <span>Creative</span>
                  </div>
                </div>

                {/* Content length */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-2 block">Content Length</label>
                  <div className="flex gap-1">
                    {(["short", "medium", "long"] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => setContentLength(l)}
                        className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          contentLength === l
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {l.charAt(0).toUpperCase() + l.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-2">
                  <Toggle label="Include hashtags" checked={includeHashtags} onChange={setIncludeHashtags} />
                  <Toggle label="Include emojis" checked={includeEmojis} onChange={setIncludeEmojis} />
                  <Toggle label="Generate A/B variants" checked={generateVariants} onChange={setGenerateVariants} />
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Trend Boost */}
          <div className={`rounded-xl border ${trendBoost ? "border-purple-300 bg-gradient-to-br from-blue-50 to-purple-50" : "border-gray-200 bg-white"} p-5`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-900">Trend Boost</h3>
              </div>
              <ToggleSwitch checked={trendBoost} onChange={setTrendBoost} />
            </div>
            <p className="text-xs text-gray-500 mb-3">Let AI find trending topics to make your content more relevant</p>

            {trendBoost && (
              <div className="space-y-3">
                <select
                  value={trendIndustry}
                  onChange={(e) => setTrendIndustry(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                >
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    Trending in {trendIndustry}
                  </p>
                  {loadingTrends ? (
                    <div className="flex gap-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-gray-200" />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {trendKeywords.map((tk) => (
                        <button
                          key={tk.keyword}
                          onClick={() => toggleTrendKeyword(tk.keyword)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                            selectedTrendKeywords.includes(tk.keyword)
                              ? "bg-orange-500 text-white"
                              : "bg-orange-50 text-orange-700 hover:bg-orange-100"
                          }`}
                        >
                          🔥 {tk.keyword}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !getSourceContent() || selectedPlatforms.length === 0}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-sm font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Generating for {selectedPlatforms.length} platform{selectedPlatforms.length > 1 ? "s" : ""}...
              </>
            ) : results ? (
              <>
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Content
              </>
            )}
          </button>
          {!generating && !results && selectedPlatforms.length > 1 && (
            <p className="text-center text-[11px] text-gray-400">~15 seconds for {selectedPlatforms.length} platforms</p>
          )}
        </div>

        {/* RIGHT PANEL — Output display */}
        <div className="lg:col-span-3">
          {!results && !generating && (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-12 text-center">
              <Sparkles className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">Your generated content will appear here</p>
              <p className="text-xs text-gray-400 mt-1">Select platforms and provide a topic to get started</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {selectedPlatforms.map((p) => (
                  <div key={p} className="rounded-lg bg-white border border-gray-200 p-4 animate-pulse">
                    <div className="h-3 w-16 bg-gray-200 rounded mb-3" />
                    <div className="space-y-2">
                      <div className="h-2 w-full bg-gray-100 rounded" />
                      <div className="h-2 w-4/5 bg-gray-100 rounded" />
                      <div className="h-2 w-3/5 bg-gray-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {generating && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Generating content...</h3>
              <div className="space-y-3">
                {selectedPlatforms.map((p, idx) => (
                  <div key={p} className="flex items-center gap-3">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center ${
                      generatingPlatform === p ? "bg-blue-100" : "bg-gray-100"
                    }`}>
                      {generatingPlatform === p ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-gray-300" />
                      )}
                    </div>
                    <span className={`text-sm ${generatingPlatform === p ? "text-blue-700 font-medium" : "text-gray-400"}`}>
                      {PLATFORMS.find((x) => x.value === p)?.label}...
                    </span>
                  </div>
                ))}
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
          )}

          {results && (
            <div className="space-y-4">
              {/* Platform tabs */}
              <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
                {selectedPlatforms.map((p) => {
                  const r = results[p];
                  const score = r?.quality_score || 0;
                  return (
                    <button
                      key={p}
                      onClick={() => setActiveTab(p)}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === p
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {getPlatformIcon(p)}
                      {PLATFORMS.find((x) => x.value === p)?.label}
                      {r?.success && (
                        <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${getScoreColor(score)}`}>
                          {score}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active platform content */}
              {activeTab && results[activeTab] && (
                <PlatformOutput
                  platform={activeTab}
                  result={results[activeTab]}
                  variant={results[`${activeTab}_variant`]}
                  onCopy={() => handleCopy(activeTab)}
                  copied={copiedPlatform === activeTab}
                  charLimit={PLATFORMS.find((x) => x.value === activeTab)?.charLimit || 3000}
                />
              )}

              {/* Bottom actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveAll}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save All as Drafts
                </button>
                <button
                  onClick={() => { handleSaveAll(); }}
                  className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Approve All & Schedule
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== Sub-components ===== */

function PlatformOutput({
  platform,
  result,
  variant,
  onCopy,
  copied,
  charLimit,
}: {
  platform: string;
  result: PlatformResult;
  variant?: PlatformResult;
  onCopy: () => void;
  copied: boolean;
  charLimit: number;
}) {
  const [showVariant, setShowVariant] = useState(false);
  const active = showVariant && variant ? variant : result;
  const charCount = (active.body || "").length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900 capitalize">{platform}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            charCount <= charLimit ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}>
            {charCount.toLocaleString()} / {charLimit.toLocaleString()}
          </span>
        </div>
        {result.quality_score !== undefined && (
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  result.quality_score >= 8 ? "bg-green-500" : result.quality_score >= 6 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${(result.quality_score / 10) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-600">{result.quality_score}/10</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="rounded-lg bg-gray-50 p-4">
        <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">{active.body}</p>
      </div>

      {/* Hashtags */}
      {active.hashtags && active.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {active.hashtags.map((h, i) => (
            <span key={i} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              #{h.replace(/^#/, "")}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        {variant && (
          <button
            onClick={() => setShowVariant(!showVariant)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              showVariant
                ? "border-purple-300 bg-purple-50 text-purple-700"
                : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {showVariant ? "Original" : "View Variant"}
          </button>
        )}
      </div>

      {/* Platform Preview Mockup */}
      <PlatformPreview platform={platform} body={active.body} hashtags={active.hashtags} />
    </div>
  );
}

function PlatformPreview({ platform, body, hashtags }: { platform: string; body: string; hashtags?: string[] }) {
  const previewText = body.length > 150 ? body.slice(0, 150) + "..." : body;

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 mt-2">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">Preview</p>
      {platform === "linkedin" && (
        <div className="rounded-lg bg-white border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-blue-100" />
            <div>
              <p className="text-xs font-semibold text-gray-900">Your Brand</p>
              <p className="text-[10px] text-gray-400">1h • 🌐</p>
            </div>
          </div>
          <p className="text-xs text-gray-700 leading-relaxed">{previewText}</p>
        </div>
      )}
      {platform === "twitter" && (
        <div className="rounded-lg bg-white border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-full bg-gray-200" />
            <div>
              <p className="text-xs font-semibold text-gray-900">Your Brand <span className="font-normal text-gray-400">@yourbrand</span></p>
            </div>
          </div>
          <p className="text-xs text-gray-700">{previewText}</p>
          <div className="flex gap-6 mt-2 text-gray-400">
            <span className="text-[10px]">💬 Reply</span>
            <span className="text-[10px]">🔁 Repost</span>
            <span className="text-[10px]">❤️ Like</span>
          </div>
        </div>
      )}
      {platform === "instagram" && (
        <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
          <div className="h-20 bg-gradient-to-br from-purple-100 to-pink-100" />
          <div className="p-3">
            <p className="text-xs text-gray-700">{previewText}</p>
            {hashtags && hashtags.length > 0 && (
              <p className="text-xs text-blue-500 mt-1">{hashtags.slice(0, 5).map((h) => `#${h.replace(/^#/, "")}`).join(" ")}</p>
            )}
          </div>
        </div>
      )}
      {platform === "facebook" && (
        <div className="rounded-lg bg-white border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-blue-100" />
            <div>
              <p className="text-xs font-semibold text-gray-900">Your Brand</p>
              <p className="text-[10px] text-gray-400">Just now • 🌐</p>
            </div>
          </div>
          <p className="text-xs text-gray-700 leading-relaxed">{previewText}</p>
          <div className="flex gap-4 mt-2 pt-2 border-t border-gray-100 text-gray-400">
            <span className="text-[10px]">👍 Like</span>
            <span className="text-[10px]">💬 Comment</span>
            <span className="text-[10px]">↗️ Share</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-xs text-gray-700">{label}</span>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </label>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-300"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
          checked ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}
