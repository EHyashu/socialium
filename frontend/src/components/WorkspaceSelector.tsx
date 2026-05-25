"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { listWorkspaces, createWorkspace } from "@/services/workspace";
import { getCurrentWorkspace, setCurrentWorkspace } from "@/lib/workspace";
import type { Workspace } from "@/types";
import toast from "react-hot-toast";

interface WorkspaceSelectorProps {
  compact?: boolean;
}

export default function WorkspaceSelector({ compact = false }: WorkspaceSelectorProps) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const data = await listWorkspaces();
      setWorkspaces(data);
      
      const current = getCurrentWorkspace();
      if (current && data.some(w => w.id === current.id)) {
        setCurrentWorkspaceState(current);
      } else if (data.length > 0) {
        setCurrentWorkspaceState(data[0]);
        setCurrentWorkspace(data[0]);
      }
    } catch (error) {
      console.error("Failed to load workspaces:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorkspace = (workspace: Workspace) => {
    setCurrentWorkspaceState(workspace);
    setCurrentWorkspace(workspace);
    setIsOpen(false);
    toast.success(`Switched to ${workspace.name}`);
    router.refresh();
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast.error("Workspace name is required");
      return;
    }

    try {
      const newWorkspace = await createWorkspace({
        name: newWorkspaceName,
        description: "",
      });
      
      setWorkspaces([...workspaces, newWorkspace]);
      handleSelectWorkspace(newWorkspace);
      setShowCreateModal(false);
      setNewWorkspaceName("");
      toast.success("Workspace created!");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to create workspace");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--bg-hover)" }}>
        <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Loading...</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
          style={{ background: "var(--bg-hover)" }}
        >
          <span className="material-symbols-outlined text-sm">business</span>
          <span className="text-sm font-medium truncate max-w-[150px]" style={{ color: "var(--text-primary)" }}>
            {currentWorkspace?.name || "Select Workspace"}
          </span>
          <span className="material-symbols-outlined text-sm">expand_more</span>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div
              className="absolute top-full left-0 mt-2 w-64 rounded-lg border shadow-xl z-50 overflow-hidden"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
            >
              <div className="p-2 max-h-64 overflow-y-auto">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => handleSelectWorkspace(workspace)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                      currentWorkspace?.id === workspace.id
                        ? "bg-indigo-600 text-white"
                        : "hover:bg-white/10"
                    }`}
                  >
                    <p className="text-sm font-medium truncate">{workspace.name}</p>
                    {workspace.description && (
                      <p className="text-xs truncate opacity-75">{workspace.description}</p>
                    )}
                  </button>
                ))}
              </div>
              <div className="border-t p-2" style={{ borderColor: "var(--border-color)" }}>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowCreateModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-white/10 transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Create Workspace
                </button>
              </div>
            </div>
          </>
        )}

        {/* Create Workspace Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div
              className="w-full max-w-md rounded-xl border shadow-2xl p-6"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>
                Create New Workspace
              </h3>
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Workspace name"
                className="w-full border rounded-lg px-4 py-2 mb-4 focus:outline-none"
                style={{
                  background: "var(--bg-hover)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewWorkspaceName("");
                  }}
                  className="flex-1 px-4 py-2 rounded-lg border hover:bg-white/10 transition-colors"
                  style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWorkspace}
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full version for settings page
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
        Your Workspaces
      </h3>
      <div className="space-y-2">
        {workspaces.map((workspace) => (
          <button
            key={workspace.id}
            onClick={() => handleSelectWorkspace(workspace)}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              currentWorkspace?.id === workspace.id
                ? "border-indigo-500 bg-indigo-600/10"
                : "hover:border-gray-400"
            }`}
            style={{
              background: currentWorkspace?.id === workspace.id ? "var(--bg-hover)" : "var(--bg-card)",
              borderColor: currentWorkspace?.id === workspace.id ? "#6366f1" : "var(--border-color)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {workspace.name}
                </p>
                {workspace.description && (
                  <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                    {workspace.description}
                  </p>
                )}
              </div>
              {currentWorkspace?.id === workspace.id && (
                <span className="material-symbols-outlined" style={{ color: "#6366f1" }}>
                  check_circle
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={() => setShowCreateModal(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed hover:bg-white/5 transition-colors"
        style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
      >
        <span className="material-symbols-outlined">add</span>
        Create New Workspace
      </button>
    </div>
  );
}
