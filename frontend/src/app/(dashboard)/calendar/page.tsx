"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { requireWorkspaceId } from "@/lib/workspace";
import { listContent } from "@/services/content";
import type { Content } from "@/types";
import Link from "next/link";
import toast from "react-hot-toast";

export default function CalendarPage() {
  const workspaceId = requireWorkspaceId();
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      const data = await listContent(workspaceId);
      setContent(data);
    } catch (error) {
      console.error("Failed to load content:", error);
      toast.error("Failed to load content");
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];
    
    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const getContentForDate = (day: number) => {
    if (!day) return [];
    
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    return content.filter(c => {
      if (!c.scheduled_at) return false;
      const contentDate = new Date(c.scheduled_at).toISOString().split('T')[0];
      return contentDate === dateStr;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      case 'published': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'draft': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'pending_approval': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'linkedin': return 'business_center';
      case 'twitter': return 'tag';
      case 'instagram': return 'photo_camera';
      case 'facebook': return 'group';
      default: return 'public';
    }
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <span className="material-symbols-outlined text-4xl animate-spin" style={{ color: "#6366f1" }}>progress_activity</span>
      </div>
    );
  }

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            Content Calendar
          </h1>
          <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
            Schedule and visualize your content pipeline
          </p>
        </div>
        <Link
          href="/content/generate"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          <span className="material-symbols-outlined">add</span>
          Create Content
        </Link>
      </div>

      {/* Calendar Navigation */}
      <div className="glass-card rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-primary)" }}
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {monthName}
          </h2>
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-primary)" }}
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div
              key={day}
              className="text-center text-sm font-bold py-2"
              style={{ color: "var(--text-secondary)" }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            const dayContent = getContentForDate(day || 0);
            const isToday = day === new Date().getDate() &&
                           currentDate.getMonth() === new Date().getMonth() &&
                           currentDate.getFullYear() === new Date().getFullYear();

            return (
              <motion.div
                key={index}
                whileHover={{ scale: day ? 1.02 : 1 }}
                className={`min-h-[100px] p-2 rounded-lg border transition-all ${
                  day ? 'cursor-pointer hover:border-indigo-500/50' : 'cursor-default'
                } ${isToday ? 'border-indigo-500 bg-indigo-500/10' : 'border-transparent'}`}
                style={{
                  background: day ? "var(--bg-card)" : "transparent",
                }}
                onClick={() => day && setSelectedDate(`${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${day}`)}
              >
                {day && (
                  <>
                    <p className={`text-sm font-medium mb-1 ${isToday ? 'text-indigo-400' : ''}`} style={{ color: "var(--text-primary)" }}>
                      {day}
                    </p>
                    <div className="space-y-1">
                      {dayContent.slice(0, 2).map((c) => (
                        <div
                          key={c.id}
                          className={`text-xs px-2 py-1 rounded border ${getStatusColor(c.status)}`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>
                              {getPlatformIcon(c.platform || '')}
                            </span>
                            <span className="truncate">{c.title || 'Untitled'}</span>
                          </div>
                        </div>
                      ))}
                      {dayContent.length > 2 && (
                        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          +{dayContent.length - 2} more
                        </p>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Scheduled</p>
          <p className="text-2xl font-bold" style={{ color: "#6366f1" }}>
            {content.filter(c => c.status === 'scheduled').length}
          </p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Published</p>
          <p className="text-2xl font-bold" style={{ color: "#10b981" }}>
            {content.filter(c => c.status === 'published').length}
          </p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Drafts</p>
          <p className="text-2xl font-bold" style={{ color: "#9ca3af" }}>
            {content.filter(c => c.status === 'draft').length}
          </p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Pending</p>
          <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>
            {content.filter(c => c.status === 'pending_approval').length}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 glass-card rounded-xl p-4">
        <p className="text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>Status Legend</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-indigo-500/20 border border-indigo-500/30"></div>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30"></div>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Published</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-500/20 border border-gray-500/30"></div>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Draft</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30"></div>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Pending Approval</span>
          </div>
        </div>
      </div>
    </div>
  );
}
