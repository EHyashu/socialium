"use client";

import { useEffect, useState } from "react";
import { Sparkles, Trash2, Eye, Send, Zap, Calendar, Clock } from "lucide-react";
import { listContent, deleteContent, submitForApproval } from "@/services/content";
import { requireWorkspaceId } from "@/lib/workspace";
import type { Content } from "@/types";
import { formatDate, capitalize } from "@/lib/utils";
import toast from "react-hot-toast";
import api from "@/lib/api";
import Link from "next/link";

export default function ContentPage() {
  const workspaceId = requireWorkspaceId();
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [publishing, setPublishing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // Pass status filter to API (convert "all" to undefined)
      const statusParam = statusFilter === "all" ? undefined : statusFilter;
      const data = await listContent(workspaceId, statusParam);
      setContents(data);
    } catch {
      toast.error("Failed to load content");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter, workspaceId]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this content?")) return;
    try {
      await deleteContent(id);
      setContents((prev) => prev.filter((c) => c.id !== id));
      toast.success("Content deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleSubmitForApproval = async (id: string) => {
    try {
      const result = await submitForApproval(id);
      
      if (result.whatsapp_sent) {
        toast.success("Submitted! WhatsApp notification sent");
      } else {
        toast.success("Submitted for approval" + (result.reason ? ` - ${result.reason}` : ""));
      }
      
      // Update the content in the list
      setContents((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: "pending_approval" as const } : c
        )
      );
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || "Failed to submit for approval";
      toast.error(errorMsg);
    }
  };

  const handlePublishNow = async (id: string) => {
    if (!confirm("Publish this post right now?")) return;
    
    setPublishing(id);
    try {
      const response = await api.post(`/content/${id}/publish-now`);
      
      if (response.data.success) {
        toast.success("✅ Published successfully!");
        
        // Open the platform post in new tab if URL provided
        if (response.data.platform_url) {
          window.open(response.data.platform_url, "_blank");
        }
        
        // Update the content in the list
        setContents((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, status: "published" as const } : c
          )
        );
      } else {
        toast.error(`Failed to publish: ${response.data.error}`);
      }
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || "Failed to publish";
      toast.error(errorMsg);
    } finally {
      setPublishing(null);
    }
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      draft: "bg-gray-500/20 text-gray-400",
      pending_approval: "bg-amber-500/20 text-amber-400",
      approved: "bg-blue-500/20 text-blue-400",
      scheduled: "bg-indigo-500/20 text-indigo-400",
      published: "bg-green-500/20 text-green-400",
      rejected: "bg-red-500/20 text-red-400",
      failed: "bg-red-500/20 text-red-400",
    };
    return colors[status] || "bg-gray-500/20 text-gray-400";
  };

  const getPlatformIcon = (platform: string): string => {
    const icons: Record<string, string> = {
      linkedin: "business_center",
      twitter: "tag",
      instagram: "photo_camera",
      facebook: "group",
      whatsapp: "chat",
    };
    return icons[platform?.toLowerCase()] || "article";
  };

  const formatScheduledTime = (scheduledAt: string | null): { day: string; time: string } | null => {
    if (!scheduledAt) return null;
    
    const date = new Date(scheduledAt);
    const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    return { day, time };
  };

  const filters = [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "pending_approval", label: "Pending approval" },
    { value: "scheduled", label: "Scheduled" },
    { value: "published", label: "Published" },
  ];

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Content</h1>
          <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
            Manage and create your social media posts
          </p>
        </div>
        <Link
          href="/content/generate"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          AI Generate
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              statusFilter === filter.value
                ? "bg-indigo-600 text-white shadow-lg"
                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {filter.label}
            {filter.value !== "all" && (
              <span className="ml-2 text-xs opacity-75">
                {filter.value === "all" 
                  ? contents.length 
                  : contents.filter(c => c.status === filter.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="material-symbols-outlined text-4xl animate-spin" style={{ color: "#6366f1" }}>progress_activity</span>
        </div>
      ) : contents.length === 0 ? (
        <div className="glass-card rounded-xl py-16 text-center">
          <span className="material-symbols-outlined text-6xl mb-4" style={{ color: "var(--text-secondary)", opacity: 0.3 }}>article</span>
          <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>No content found</p>
          <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
            {statusFilter !== "all" 
              ? `No ${statusFilter.replace("_", " ")} content. Try a different filter.` 
              : "Create your first post to get started!"}
          </p>
          <Link
            href="/content/generate"
            className="mt-4 inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Create Content
          </Link>
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead style={{ background: "var(--bg-hover)" }}>
                <tr className="border-b" style={{ borderColor: "var(--border-color)" }}>
                  <th className="px-5 py-4 font-semibold" style={{ color: "var(--text-secondary)" }}>Title</th>
                  <th className="px-5 py-4 font-semibold" style={{ color: "var(--text-secondary)" }}>Platform</th>
                  <th className="px-5 py-4 font-semibold" style={{ color: "var(--text-secondary)" }}>Status</th>
                  <th className="hidden lg:table-cell px-5 py-4 font-semibold" style={{ color: "var(--text-secondary)" }}>Scheduled</th>
                  <th className="hidden md:table-cell px-5 py-4 font-semibold" style={{ color: "var(--text-secondary)" }}>Created</th>
                  <th className="px-5 py-4 font-semibold" style={{ color: "var(--text-secondary)" }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                {contents.map((item) => {
                  const scheduledTime = formatScheduledTime(item.scheduled_at);
                  
                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-medium" style={{ color: "var(--text-primary)" }}>
                          {item.title || "Untitled"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-lg" style={{ color: "var(--text-secondary)" }}>
                            {getPlatformIcon(item.platform || "")}
                          </span>
                          <span className="capitalize" style={{ color: "var(--text-secondary)" }}>
                            {item.platform || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(item.status)}`}>
                          {capitalize(item.status.replace("_", " "))}
                        </span>
                      </td>
                      <td className="hidden lg:table-cell px-5 py-4">
                        {item.status === "scheduled" && scheduledTime ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                              <Calendar className="h-3.5 w-3.5" />
                              <span className="text-xs font-medium">{scheduledTime.day}</span>
                            </div>
                            <div className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                              <Clock className="h-3.5 w-3.5" />
                              <span className="text-xs">{scheduledTime.time}</span>
                            </div>
                          </div>
                        ) : item.status === "published" && item.published_at ? (
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            {formatDate(item.published_at)}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--text-secondary)", opacity: 0.5 }}>—</span>
                        )}
                      </td>
                      <td className="hidden md:table-cell px-5 py-4" style={{ color: "var(--text-secondary)" }}>
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/content/${item.id}`}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            style={{ color: "var(--text-secondary)" }}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          
                          {(item.status === "approved" || item.status === "scheduled") && (
                            <button
                              onClick={() => handlePublishNow(item.id)}
                              disabled={publishing === item.id}
                              className="p-2 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors disabled:opacity-50"
                              style={{ color: "var(--text-secondary)" }}
                              title="Publish now"
                            >
                              {publishing === item.id ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              ) : (
                                <Zap className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          
                          {item.status === "draft" && (
                            <button
                              onClick={() => handleSubmitForApproval(item.id)}
                              className="p-2 rounded-lg hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors"
                              style={{ color: "var(--text-secondary)" }}
                              title="Submit for approval"
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors"
                            style={{ color: "var(--text-secondary)" }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
