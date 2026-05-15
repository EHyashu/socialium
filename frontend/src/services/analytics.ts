import api from "@/lib/api";
import type { AnalyticsOverview } from "@/types";

export async function getAnalyticsOverview(workspaceId: string): Promise<AnalyticsOverview> {
  const res = await api.get<AnalyticsOverview>(`/analytics/overview?workspace_id=${workspaceId}`);
  return res.data;
}

export async function getAnalyticsTimeline(workspaceId: string, days: number = 30) {
  const res = await api.get(`/analytics/timeline?workspace_id=${workspaceId}&days=${days}`);
  return res.data;
}
