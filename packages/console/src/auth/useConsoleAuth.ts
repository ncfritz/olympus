"use client";

import useSWR from "swr";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/** What the shell needs to know about the session. */
export interface ConsoleAuth {
  status: AuthStatus;
  email?: string;
  logout: () => Promise<void>;
  /** Where the "sign in with <provider>" button goes. */
  signInHref: (provider: string) => string;
}

export interface ConsoleAuthOptions {
  /** The agent's base URL: `/minerva/calendar/api`. */
  apiUrl: string;
  /**
   * Where sign-in returns to. Defaults to this console's own root — the
   * origin alone would land in the suite's index instead.
   */
  returnTo?: string;
  /** Overridable for tests. */
  fetcher?: typeof fetch;
}

interface CurrentUser {
  email?: string;
}

/**
 * The console's half of the session. The access token itself is in an
 * httpOnly cookie set by the agent's `/auth/callback`, so this never sees
 * it: it asks the agent whether the browser's current cookie is good for
 * anything.
 *
 * Every agent's auth module serves the same three routes, so this is
 * plain `fetch` rather than a generated client — it works for any console
 * without knowing that console's API.
 */
export const useConsoleAuth = ({
  apiUrl,
  returnTo,
  fetcher = fetch,
}: ConsoleAuthOptions): ConsoleAuth => {
  const {
    data: user,
    isLoading,
    mutate,
  } = useSWR<CurrentUser | null>(
    `${apiUrl}/v1/auth/current-user`,
    async (url: string) => {
      const response = await fetcher(url, { credentials: "include" });
      if (!response.ok) return null;
      const body = (await response.json()) as { user?: CurrentUser } | null;
      return body?.user ?? null;
    },
  );

  const status: AuthStatus = isLoading
    ? "loading"
    : user
      ? "authenticated"
      : "unauthenticated";

  const logout = async (): Promise<void> => {
    await fetcher(`${apiUrl}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    await mutate(null, { revalidate: false });
  };

  const signInHref = (provider: string): string => {
    const target =
      returnTo ??
      (typeof window === "undefined"
        ? ""
        : `${window.location.origin}${consoleRootOf(apiUrl)}`);
    return `${apiUrl}/auth/login/${provider}?returnTo=${encodeURIComponent(target)}`;
  };

  return { status, email: user?.email, logout, signInHref };
};

/** `/minerva/calendar/api` -> `/minerva/calendar`; an absolute URL is left alone. */
const consoleRootOf = (apiUrl: string): string =>
  apiUrl.startsWith("/") ? apiUrl.replace(/\/api\/?$/, "") : "";
