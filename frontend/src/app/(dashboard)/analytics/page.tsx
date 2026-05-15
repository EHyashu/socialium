"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, Heart, MessageCircle, Share2 } from "lucide-react";
import { capitalize } from "@/lib/utils";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false);

  const mockStats = [
    { label: "Total Engagement", value: "2,847", icon: TrendingUp, color: "bg-blue-50 text-blue-600" },
    { label: "Total Likes", value: "1,523", icon: Heart, color: "bg-pink-50 text-pink-600" },
    { label: "Comments", value: "847", icon: MessageCircle, color: "bg-green-50 text-green-600" },
    { label: "Shares", value: "477", icon: Share2, color: "bg-purple-50 text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Track performance across your platforms</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {mockStats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
              <div className={`rounded-lg p-2 ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Placeholder chart area */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Engagement Over Time</h2>
        <div className="flex h-64 items-center justify-center rounded-lg bg-gray-50">
          <div className="text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              Connect platforms and publish content to see analytics here
            </p>
          </div>
        </div>
      </div>

      {/* Platform breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Platform Breakdown</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {["linkedin", "twitter", "instagram", "facebook", "whatsapp"].map((platform) => (
            <div key={platform} className="rounded-lg border border-gray-100 p-4 text-center">
              <p className="text-sm font-medium text-gray-900">{capitalize(platform)}</p>
              <p className="mt-1 text-2xl font-bold text-gray-400">0</p>
              <p className="text-xs text-gray-500">posts</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
