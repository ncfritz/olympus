"use client";

import useSWR from "swr";
import { fetchMe, logout as logoutRequest } from "../api/queries";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/**
 * The access token itself lives in an httpOnly cookie set by the API's
 * /auth/callback — this hook never sees it, it just asks /v1/auth/current-user whether
 * the browser's current cookie is valid.
 */
export function useAuth() {
  const {
    data: user,
    isLoading,
    mutate,
  } = useSWR("/v1/auth/current-user", fetchMe);

  const status: AuthStatus = isLoading
    ? "loading"
    : user
      ? "authenticated"
      : "unauthenticated";

  async function logout() {
    await logoutRequest();
    await mutate(null, { revalidate: false });
  }

  return { status, email: user?.email, logout };
}
