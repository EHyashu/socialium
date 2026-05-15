"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, Send } from "lucide-react";
import { listScheduled, publishNow } from "@/services/scheduling";
import type { ScheduledPost } from "@/types";
import { formatDateTime, capitalize } from "@/lib/utils";
import toast from "react-hot-toast";

export default function SchedulingPage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await listScheduled();
        setPosts(data);
      } catch {
        toast.error("Failed to load scheduled posts");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handlePublishNow = async (id: string) => {
    try {
      await publishNow(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Published!");
    } catch {
      toast.error("Failed to publish");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scheduling</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your upcoming scheduled posts</p>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <Calendar className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-gray-500">No scheduled posts</p>
          <p className="text-sm text-gray-400 mt-1">
            Create content and schedule it for publishing
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-purple-50 p-2">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{post.title || "Untitled"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {post.platform && (
                      <span className="text-xs text-gray-500">{capitalize(post.platform)}</span>
                    )}
                    {post.scheduled_at && (
                      <span className="text-xs text-gray-400">
                        {formatDateTime(post.scheduled_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handlePublishNow(post.id)}
                className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
              >
                <Send className="h-3.5 w-3.5" />
                Publish Now
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
