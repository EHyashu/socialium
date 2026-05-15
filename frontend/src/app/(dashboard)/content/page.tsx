"use client";

import { useEffect, useState } from "react";
import { Plus, Sparkles, Trash2, Eye } from "lucide-react";
import { listContent, deleteContent } from "@/services/content";
import type { Content } from "@/types";
import { formatDate, capitalize } from "@/lib/utils";
import toast from "react-hot-toast";

export default function ContentPage() {
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const load = async () => {
    try {
      const data = await listContent(undefined, statusFilter || undefined);
      setContents(data);
    } catch {
      toast.error("Failed to load content");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

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

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    pending_approval: "bg-yellow-100 text-yellow-700",
    approved: "bg-blue-100 text-blue-700",
    scheduled: "bg-purple-100 text-purple-700",
    published: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and create your social media posts</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/content/generate"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Sparkles className="h-4 w-4" />
            AI Generate
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {["", "draft", "pending_approval", "scheduled", "published"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === s
                ? "bg-brand-100 text-brand-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "" ? "All" : capitalize(s.replace("_", " "))}
          </button>
        ))}
      </div>

      {/* Content Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : contents.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <p className="text-gray-500">No content found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-5 py-3 font-medium text-gray-600">Title</th>
                <th className="px-5 py-3 font-medium text-gray-600">Platform</th>
                <th className="px-5 py-3 font-medium text-gray-600">Status</th>
                <th className="px-5 py-3 font-medium text-gray-600">Created</th>
                <th className="px-5 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contents.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {item.title || "Untitled"}
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {item.platform ? capitalize(item.platform) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[item.status] || ""}`}>
                      {capitalize(item.status.replace("_", " "))}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{formatDate(item.created_at)}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
