import api from "@/lib/api";
import type { SignUpRequest, SignInRequest, TokenResponse } from "@/types";

export async function signUp(data: SignUpRequest): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>("/auth/signup", data);
  return res.data;
}

export async function signIn(data: SignInRequest): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>("/auth/login", data);
  return res.data;
}

export async function refreshToken(refreshToken: string): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>("/auth/refresh", {
    refresh_token: refreshToken,
  });
  return res.data;
}
