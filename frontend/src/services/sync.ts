import api from "@/lib/api";

export async function syncLinkedInAnalytics(workspaceId: string): Promise<{ message: string; synced_count: number }> {
  const res = await api.post(`/analytics/sync-linkedin?workspace_id=${workspaceId}`);
  return res.data;
}
