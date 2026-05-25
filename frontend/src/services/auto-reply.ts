import api from "@/lib/api";

export interface AutoReplyConfig {
  workspace_id: string;
  platform: string;
  is_enabled: boolean;
  reply_tone: string;
  max_replies_per_day: number;
  sentiment_threshold: number;
  excluded_keywords: string[];
}

export interface AutoReplyActivity {
  id: string;
  platform: string;
  comment_text: string;
  reply_text: string | null;
  sentiment_score: number;
  created_at: string;
}

export interface AutoReplyStats {
  total_replies_today: number;
  average_sentiment: number;
  is_enabled: boolean;
}

export async function testAutoReply(
  commentText: string,
  platform: string,
  tone: string = "professional"
): Promise<{ should_reply: boolean; reply: string | null }> {
  const res = await api.post(
    `/auto-reply/test?comment_text=${encodeURIComponent(commentText)}&platform=${platform}&tone=${tone}`
  );
  return res.data;
}

export async function saveAutoReplyConfig(config: AutoReplyConfig) {
  const res = await api.post("/auto-reply/config", config);
  return res.data;
}

export async function getAutoReplyStats(workspaceId: string): Promise<AutoReplyStats> {
  const res = await api.get<AutoReplyStats>(`/auto-reply/stats?workspace_id=${workspaceId}`);
  return res.data;
}

export async function getAutoReplyActivity(workspaceId: string): Promise<AutoReplyActivity[]> {
  const res = await api.get<AutoReplyActivity[]>(`/auto-reply/activity?workspace_id=${workspaceId}`);
  return res.data;
}
