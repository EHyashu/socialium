"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Send, Calendar, Trash2, Copy, Check } from "lucide-react";
import { getContent, updateContent, deleteContent, submitForApproval, autoScheduleContent } from "@/services/content";
import { requireWorkspaceId, fetchAndStoreWorkspace } from "@/lib/workspace";
import type { Content } from "@/types";
import { formatDate, capitalize } from "@/lib/utils";
import toast from "react-hot-toast";

import { useUIStore } from "@/store/use-ui-store";

export default function ContentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [workspaceId, setWorkspaceId] = useState("");

  useEffect(() => {
    const id = requireWorkspaceId();
    if (!id) {
      fetchAndStoreWorkspace().then(fetched => {
        if (fetched) setWorkspaceId(fetched);
      });
    } else {
      setWorkspaceId(id);
    }
  }, []);
  const contentId = params.id as string;
  const { confirm } = useUIStore();
  
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    load();
  }, [contentId]);

  const load = async () => {
    try {
      const data = await getContent(contentId);
      setContent(data);
      setEditBody(data.body ?? "");
    } catch {
      toast.error("Failed to load content");
      router.push("/content");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const updated = await updateContent(contentId, { body: editBody });
      setContent(updated);
      setEditing(false);
      toast.success("Content updated");
    } catch {
      toast.error("Failed to update content");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    const confirmed = await confirm("Submit this content for approval?");
    if (!confirmed) return;
    
    setSubmitting(true);
    try {
      const result = await submitForApproval(contentId);
      
      if (result.whatsapp_sent) {
        toast.success("Submitted! WhatsApp notification sent");
      } else {
        toast.success("Submitted for approval" + (result.reason ? ` - ${result.reason}` : ""));
      }
      
      // Reload to get updated status
      await load();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || "Failed to submit for approval";
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoSchedule = async () => {
    const confirmed = await confirm("AI will analyze your content and automatically schedule it at the optimal time. Continue?");
    if (!confirmed) return;
    
    setAutoScheduling(true);
    try {
      const result = await autoScheduleContent(contentId);
      
      if (result.decision.action === "auto_scheduled") {
        toast.success(`✅ AI auto-scheduled for ${formatDate(result.decision.scheduled_time!)}`);
        await load();
      } else if (result.decision.action === "suggest_times") {
        toast.success("AI analysis complete! Go to Scheduling page to review optimal times");
        router.push("/scheduling");
      } else if (result.decision.action === "improve_content") {
        toast.error(`Content needs improvement: ${result.decision.improvement_suggestion}`);
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || "Failed to auto-schedule";
      toast.error(errorMsg);
    } finally {
      setAutoScheduling(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm("Delete this content?");
    if (!confirmed) return;
    try {
      await deleteContent(contentId);
      toast.success("Content deleted");
      router.push("/content");
    } catch {
      toast.error("Failed to delete content");
    }
  };

  const handleCopy = () => {
    if (content?.body) {
      navigator.clipboard.writeText(content.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied to clipboard");
    }
  };

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    pending_approval: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    approved: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    scheduled: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    published: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };

  const nextActions = {
    draft: { label: "Submit for Approval", icon: Send, action: handleSubmitForApproval, color: "bg-brand-600 hover:bg-brand-700" },
    pending_approval: null,
    approved: { label: "AI Auto-Schedule", icon: Calendar, action: handleAutoSchedule, color: "bg-purple-600 hover:bg-purple-700" },
    scheduled: null,
    published: null,
    rejected: { label: "Edit & Resubmit", icon: Send, action: () => setEditing(true), color: "bg-brand-600 hover:bg-brand-700" },
    failed: { label: "Retry Publishing", icon: Calendar, action: () => router.push(`/scheduling?contentId=${contentId}`), color: "bg-orange-600 hover:bg-orange-700" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Content not found</p>
      </div>
    );
  }

  const action = nextActions[content.status];
  const ActionIcon = action?.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{content.title || "Untitled"}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[content.status] || ""}`}>
                {capitalize(content.status.replace("_", " "))}
              </span>
              <span className="text-sm text-gray-500">{capitalize(content.platform ?? "")}</span>
              <span className="text-sm text-gray-400">•</span>
              <span className="text-sm text-gray-500">{formatDate(content.created_at)}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="rounded-lg px-3 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg px-3 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="rounded-lg px-3 py-2 text-sm font-medium bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Action Button */}
      {action && (
        <button
          onClick={action.action}
          disabled={submitting}
          className={`w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white transition-colors ${action.color} disabled:opacity-50`}
        >
          {ActionIcon && <ActionIcon className="h-4 w-4" />}
          {submitting ? "Submitting..." : autoScheduling ? "AI Scheduling..." : action.label}
        </button>
      )}

      {/* Content Body */}
      <div className="rounded-xl border p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        {editing ? (
          <div className="space-y-4">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={15}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setEditing(false);
                  setEditBody(content.body ?? "");
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900 dark:text-white bg-transparent p-0 border-0">
              {content.body}
            </pre>
          </div>
        )}
      </div>

      {/* Metadata */}
      {content.hashtags && content.hashtags.length > 0 && (
        <div className="rounded-xl border p-4 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hashtags</h3>
          <div className="flex flex-wrap gap-2">
            {content.hashtags.map((tag, i) => (
              <span key={i} className="rounded-full bg-blue-100 dark:bg-blue-900 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Quality Score */}
      {content.quality_score && (
        <div className="rounded-xl border p-4 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quality Score</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Score</span>
                <span className="font-medium text-gray-900 dark:text-white">{content.quality_score}/10</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-brand-600"
                  style={{ width: `${(content.quality_score / 10) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
