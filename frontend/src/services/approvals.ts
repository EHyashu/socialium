import api from "@/lib/api";

export interface Approval {
  id: string;
  content_id: string;
  reviewer_id: string;
  action: "approve" | "reject" | "request_changes";
  comment: string | null;
  created_at: string;
}

export async function listApprovals(workspaceId: string): Promise<Approval[]> {
  const res = await api.get<Approval[]>(`/approvals?workspace_id=${workspaceId}`);
  return res.data;
}

export async function submitApproval(
  contentId: string,
  action: "approve" | "reject" | "request_changes",
  comment?: string
) {
  const res = await api.post(
    `/approvals?content_id=${contentId}&action=${action}&comment=${encodeURIComponent(comment || "")}`
  );
  return res.data;
}
