/**
 * Workspace management utility.
 * Handles workspace selection and persistence in localStorage.
 */

import type { Workspace } from "@/types";

const WORKSPACE_STORAGE_KEY = "current_workspace";

export function getCurrentWorkspace(): Workspace | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Workspace;
  } catch {
    return null;
  }
}

export function setCurrentWorkspace(workspace: Workspace): void {
  localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
}

export function getWorkspaceId(): string | null {
  const workspace = getCurrentWorkspace();
  return workspace?.id || null;
}

export function requireWorkspaceId(): string {
  const id = getWorkspaceId();
  return id || "";
}

export async function fetchAndStoreWorkspace(): Promise<string | null> {
  try {
    const api = (await import("@/lib/api")).default;
    const res = await api.get("/workspaces");
    const workspaces = res.data;
    if (workspaces && workspaces.length > 0) {
      setCurrentWorkspace(workspaces[0]);
      return workspaces[0].id;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearWorkspace(): void {
  localStorage.removeItem(WORKSPACE_STORAGE_KEY);
}
