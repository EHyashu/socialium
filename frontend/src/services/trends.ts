import api from "@/lib/api";

export interface TrendKeyword {
  keyword: string;
  trend_score: number;
  source: string;
}

export async function fetchTrendingKeywords(industry: string, count: number = 10): Promise<TrendKeyword[]> {
  const res = await api.get<{ industry: string; keywords: TrendKeyword[]; cached: boolean }>(
    `/trends/keywords?industry=${encodeURIComponent(industry)}&count=${count}`
  );
  return res.data.keywords;
}
