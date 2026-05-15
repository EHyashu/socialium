import api from "@/lib/api";
import type { Workspace, WorkspaceMember } from "@/types";

export async function listWorkspaces(): Promise<Workspace[]> {
  const res = await api.get<Workspace[]>("/workspaces");
  return res.data;
}

export async function getWorkspace(workspaceId: string): Promise<Workspace> {
  const res = await api.get<Workspace>(`/workspaces/${workspaceId}`);
  return res.data;
}

export async function createWorkspace(data: { name: string; description?: string }): Promise<Workspace> {
  const res = await api.post<Workspace>("/workspaces", data);
  return res.data;
}

export async function updateWorkspace(workspaceId: string, data: Partial<Workspace>): Promise<Workspace> {
  const res = await api.patch<Workspace>(`/workspaces/${workspaceId}`, data);
  return res.data;
}

export async function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const res = await api.get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`);
  return res.data;
}

export async function inviteMember(workspaceId: string, email: string, role: string) {
  const res = await api.post(`/workspaces/${workspaceId}/members`, { email, role });
  return res.data;
}
