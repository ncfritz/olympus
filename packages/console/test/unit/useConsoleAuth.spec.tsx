import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it } from "vitest";
import { useConsoleAuth } from "../../src/auth/useConsoleAuth";

const API_URL = "/minerva/calendar/api";

/** A fresh cache per test: SWR's default one is global. */
const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);

const responder = (
  handler: (url: string, init?: RequestInit) => Response,
): { calls: string[]; fetcher: typeof fetch } => {
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    return handler(url, init);
  }) as typeof fetch;
  return { calls, fetcher };
};

const signedIn = () =>
  responder(
    () =>
      new Response(JSON.stringify({ user: { email: "neil@example.test" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );

describe("useConsoleAuth", () => {
  it("starts out not knowing", () => {
    const { fetcher } = signedIn();
    const { result } = renderHook(
      () => useConsoleAuth({ apiUrl: API_URL, fetcher }),
      { wrapper },
    );
    expect(result.current.status).toBe("loading");
  });

  it("asks the agent whether the browser's cookie is good for anything", async () => {
    const { calls, fetcher } = signedIn();
    const { result } = renderHook(
      () => useConsoleAuth({ apiUrl: API_URL, fetcher }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.email).toBe("neil@example.test");
    expect(calls).toContain("GET /minerva/calendar/api/v1/auth/current-user");
  });

  it("is unauthenticated when the agent rejects the cookie", async () => {
    const { fetcher } = responder(() => new Response("", { status: 401 }));
    const { result } = renderHook(
      () => useConsoleAuth({ apiUrl: API_URL, fetcher }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.email).toBeUndefined();
  });

  it("signs out without waiting to be told again", async () => {
    const { calls, fetcher } = signedIn();
    const { result } = renderHook(
      () => useConsoleAuth({ apiUrl: API_URL, fetcher }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    await act(async () => {
      await result.current.logout();
    });

    expect(calls).toContain("POST /minerva/calendar/api/v1/auth/logout");
    expect(result.current.status).toBe("unauthenticated");
  });

  it("comes back to this console, not to the suite's index", async () => {
    const { fetcher } = signedIn();
    const { result } = renderHook(
      () => useConsoleAuth({ apiUrl: API_URL, fetcher }),
      { wrapper },
    );

    const href = result.current.signInHref("google");

    expect(href).toBe(
      `/minerva/calendar/api/auth/login/google?returnTo=${encodeURIComponent(
        `${window.location.origin}/minerva/calendar`,
      )}`,
    );
  });

  it("takes an explicit returnTo", async () => {
    const { fetcher } = signedIn();
    const { result } = renderHook(
      () =>
        useConsoleAuth({
          apiUrl: API_URL,
          returnTo: "https://control.example/minerva/calendar",
          fetcher,
        }),
      { wrapper },
    );

    expect(result.current.signInHref("google")).toContain(
      encodeURIComponent("https://control.example/minerva/calendar"),
    );
  });
});
