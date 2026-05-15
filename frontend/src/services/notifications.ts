import api from "@/lib/api";
import type { Notification } from "@/types";

export async function listNotifications(): Promise<Notification[]> {
  const res = await api.get<Notification[]>("/notifications");
  return res.data;
}

export async function markAsRead(notificationId: string): Promise<void> {
  await api.patch(`/notifications/${notificationId}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await api.post("/notifications/mark-all-read");
}
