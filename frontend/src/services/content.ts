import api from "@/lib/api";
import type { Content, ContentCreateRequest, ContentGenerateRequest, GenerateResponse } from "@/types";

export async function listContent(workspaceId?: string, status?: string): Promise<Content[]> {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspace_id", workspaceId);
  if (status) params.set("status", status);
  const res = await api.get<Content[]>(`/content?${params.toString()}`);
  return res.data;
}

export async function getContent(contentId: string): Promise<Content> {
  const res = await api.get<Content>(`/content/${contentId}`);
  return res.data;
}

export async function createContent(data: ContentCreateRequest): Promise<Content> {
  const res = await api.post<Content>("/content", data);
  return res.data;
}

export async function updateContent(contentId: string, data: Partial<ContentCreateRequest>): Promise<Content> {
  const res = await api.patch<Content>(`/content/${contentId}`, data);
  return res.data;
}

export async function deleteContent(contentId: string): Promise<void> {
  await api.delete(`/content/${contentId}`);
}

export async function generateContent(data: ContentGenerateRequest): Promise<GenerateResponse> {
  const res = await api.post<GenerateResponse>("/content/generate", data);
  return res.data;
}

export async function approveContent(contentId: string, action: string, comment?: string) {
  const res = await api.post(`/content/${contentId}/approve`, { action, comment });
  return res.data;
}

export async function scoreContent(contentId: string) {
  const res = await api.post(`/content/${contentId}/score`);
  return res.data;
}
