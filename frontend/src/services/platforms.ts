import api from "@/lib/api";
import type { PlatformAccount, Platform } from "@/types";

export async function listPlatformAccounts(): Promise<PlatformAccount[]> {
  const res = await api.get<PlatformAccount[]>("/platforms");
  return res.data;
}

export async function disconnectPlatform(accountId: string): Promise<void> {
  await api.delete(`/platforms/${accountId}`);
}

export async function getOAuthUrl(platform: Platform): Promise<string> {
  const res = await api.get<{ authorization_url: string }>(`/oauth/${platform}/authorize`);
  return res.data.authorization_url;
}

export async function handleOAuthCallback(platform: Platform, code: string, state: string) {
  const res = await api.post(`/oauth/${platform}/callback`, { code, state });
  return res.data;
}
