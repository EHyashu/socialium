import api from "@/lib/api";
import type { ScheduledPost } from "@/types";

export async function listScheduled(): Promise<ScheduledPost[]> {
  const res = await api.get<ScheduledPost[]>("/scheduling");
  return res.data;
}

export async function listDraftsReady(workspaceId?: string) {
  const params = workspaceId ? { workspace_id: workspaceId } : {};
  const res = await api.get("/scheduling/drafts-ready", { params });
  return res.data;
}

export async function scheduleContent(contentId: string, scheduledAt: string) {
  const res = await api.post(`/scheduling/${contentId}/schedule?scheduled_at=${scheduledAt}`);
  return res.data;
}

export async function publishNow(contentId: string) {
  const res = await api.post(`/scheduling/${contentId}/publish-now`);
  return res.data;
}

export async function getViralScore(contentId: string) {
  const res = await api.get(`/scheduling/viral-score/${contentId}`);
  return res.data;
}

export async function getOptimalTimes(
  platform: string,
  params?: { workspace_id?: string; target_audience?: string; viral_score?: number }
) {
  const res = await api.get(`/scheduling/optimal-times/${platform}`, { params });
  return res.data;
}

export async function autoSchedule(contentId: string, targetAudience?: string) {
  const res = await api.post(`/scheduling/${contentId}/auto-schedule`, null, {
    params: { target_audience: targetAudience || "" },
  });
  return res.data;
}

export async function bulkAutoSchedule(
  workspaceId: string,
  contentIds: string[],
  targetAudience?: string
) {
  const res = await api.post("/scheduling/bulk-auto-schedule", {
    workspace_id: workspaceId,
    content_ids: contentIds,
    target_audience: targetAudience || "",
  });
  return res.data;
}
