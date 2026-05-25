import api from "@/lib/api";

export interface UserProfile {
  full_name: string;
  email: string;
  username: string;
  default_tone?: string;
  creativity_level?: number;
  email_notifications?: boolean;
  whatsapp_notifications?: boolean;
  push_notifications?: boolean;
}

export async function getUserProfile(): Promise<UserProfile> {
  const res = await api.get<UserProfile>("/auth/me");
  return res.data;
}

export async function updateUserProfile(data: Partial<UserProfile>): Promise<UserProfile> {
  const res = await api.patch<UserProfile>("/auth/me", data);
  return res.data;
}

export async function updateNotificationSettings(settings: {
  email_notifications?: boolean;
  whatsapp_notifications?: boolean;
  push_notifications?: boolean;
}): Promise<void> {
  await api.patch("/auth/notifications", settings);
}

export async function updateAISettings(settings: {
  default_tone?: string;
  creativity_level?: number;
}): Promise<void> {
  await api.patch("/auth/ai-settings", settings);
}

export async function deleteAccount(): Promise<void> {
  await api.delete("/auth/me");
}
