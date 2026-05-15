import api from "@/lib/api";
import type { ScheduledPost } from "@/types";

export async function listScheduled(): Promise<ScheduledPost[]> {
  const res = await api.get<ScheduledPost[]>("/scheduling");
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
