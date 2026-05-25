import api from "@/lib/api";
import type { ABTest, ABTestCreate, ABTestResult } from "@/types";

export async function listABTests(workspaceId: string): Promise<ABTest[]> {
  const res = await api.get<ABTest[]>(`/ab-testing?workspace_id=${workspaceId}`);
  return res.data;
}

export async function createABTest(data: ABTestCreate): Promise<ABTest> {
  const res = await api.post<ABTest>("/ab-testing", data);
  return res.data;
}

export async function getABTest(testId: string): Promise<ABTestResult> {
  const res = await api.get<ABTestResult>(`/ab-testing/${testId}`);
  return res.data;
}

export async function evaluateABTest(testId: string): Promise<ABTestResult> {
  const res = await api.post<ABTestResult>(`/ab-testing/${testId}/evaluate`);
  return res.data;
}

export async function cancelABTest(testId: string): Promise<void> {
  await api.post(`/ab-testing/${testId}/cancel`);
}
