/* ===== Enums ===== */

export type Platform = "linkedin" | "twitter" | "instagram" | "facebook" | "whatsapp";

export type ContentStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "scheduled"
  | "published"
  | "failed";

export type ContentTone =
  | "professional"
  | "casual"
  | "humorous"
  | "inspirational"
  | "educational"
  | "promotional";

export type SourceType = "manual" | "ai_generated" | "trend_based" | "template" | "recycled";

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

export type SubscriptionTier = "free" | "pro" | "business";

/* ===== Auth ===== */

export interface SignUpRequest {
  email: string;
  password: string;
  username: string;
  full_name?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user?: UserResponse;
}

export interface UserResponse {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier;
  is_active: boolean;
  created_at: string;
}

/* ===== Workspace ===== */

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  brand_voice: string | null;
  brand_colors: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  invited_email: string | null;
  joined_at: string;
}

/* ===== Content ===== */

export interface Content {
  id: string;
  workspace_id: string;
  author_id: string;
  platform: Platform | null;
  status: ContentStatus;
  tone: ContentTone | null;
  source_type: SourceType;
  title: string | null;
  body: string | null;
  image_urls: Record<string, string> | null;
  hashtags: string[] | null;
  mentions: string[] | null;
  link_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  ai_prompt_used: string | null;
  ai_model_used: string | null;
  quality_score: number | null;
  engagement_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  ab_test_group: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentCreateRequest {
  workspace_id: string;
  platform?: Platform;
  tone?: ContentTone;
  title?: string;
  body?: string;
  image_urls?: Record<string, string>;
  hashtags?: string[];
  mentions?: string[];
  link_url?: string;
  scheduled_at?: string;
}

export interface ContentGenerateRequest {
  workspace_id: string;
  platforms: Platform[];
  platform?: Platform;
  tone?: ContentTone;
  topic?: string;
  keywords?: string[];
  target_audience?: string;
  source_text?: string;
  source_url?: string;
  max_length?: number;
  creativity?: number;
  content_length?: "short" | "medium" | "long";
  include_hashtags?: boolean;
  include_emojis?: boolean;
  include_mentions?: boolean;
  generate_variants?: boolean;
  trend_boost?: boolean;
  trend_industry?: string;
  trend_keywords?: string[];
}

export interface PlatformResult {
  title: string;
  body: string;
  hashtags: string[];
  mentions: string[];
  model_used: string;
  success: boolean;
  quality_score?: number;
  quality_details?: Record<string, number | string>;
  error?: string;
}

export interface GenerateResponse {
  results: Record<string, PlatformResult>;
  platforms: string[];
  usage: { used: number; limit: number };
}

/* ===== Platform Account ===== */

export interface PlatformAccount {
  id: string;
  user_id: string;
  platform: Platform;
  platform_user_id: string;
  platform_username: string | null;
  is_active: boolean;
  connected_at: string;
  last_synced_at: string | null;
}

/* ===== Analytics ===== */

export interface AnalyticsSummary {
  total_posts: number;
  total_impressions: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_clicks: number;
  average_engagement_rate: number;
}

export interface PlatformBreakdown {
  platform: string;
  posts: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

export interface AnalyticsOverview {
  summary: AnalyticsSummary;
  platform_breakdown: PlatformBreakdown[];
  time_series: TimeSeriesPoint[];
  top_posts: Array<{
    id: string;
    title: string | null;
    platform: string | null;
    likes: number;
    comments: number;
    shares: number;
    created_at: string | null;
  }>;
}

/* ===== Notification ===== */

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
}

/* ===== Scheduling ===== */

export interface ScheduledPost {
  id: string;
  title: string | null;
  platform: Platform | null;
  scheduled_at: string | null;
  status: ContentStatus;
}

/* ===== A/B Testing ===== */

export interface ABTest {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  platform: Platform;
  variant_a_id: string;
  variant_b_id: string;
  author_id: string;
  status: 'draft' | 'running' | 'completed' | 'cancelled';
  winner_variant: 'A' | 'B' | null;
  confidence_score: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ABTestCreate {
  workspace_id: string;
  name: string;
  description?: string;
  platform: Platform;
  variant_a_body: string;
  variant_b_body: string;
}

export interface ABTestResult {
  test: ABTest;
  variant_a_stats: {
    impressions: number;
    engagements: number;
    engagement_rate: number;
  };
  variant_b_stats: {
    impressions: number;
    engagements: number;
    engagement_rate: number;
  };
  recommendation: string;
}
