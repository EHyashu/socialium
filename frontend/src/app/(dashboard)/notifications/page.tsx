"use client";

import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { listNotifications, markAsRead, markAllAsRead } from "@/services/notifications";
import type { Notification } from "@/types";
import { formatDateTime } from "@/lib/utils";
import toast from "react-hot-toast";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await listNotifications();
        setNotifications(data);
      } catch {
        // No notifications yet
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("All marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <Bell className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-gray-500">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`flex items-start gap-4 rounded-xl border bg-white px-5 py-4 ${
                notif.is_read ? "border-gray-100" : "border-brand-200 bg-brand-50/30"
              }`}
            >
              <div className={`mt-0.5 rounded-full p-1.5 ${notif.is_read ? "bg-gray-100" : "bg-brand-100"}`}>
                <Bell className={`h-4 w-4 ${notif.is_read ? "text-gray-400" : "text-brand-600"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900">{notif.title}</p>
                <p className="text-sm text-gray-600 mt-0.5">{notif.message}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDateTime(notif.created_at)}</p>
              </div>
              {!notif.is_read && (
                <button
                  onClick={() => handleMarkRead(notif.id)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
