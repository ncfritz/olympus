import { CLIENT_HEADER } from "@ncfritz/olympus-metrics";
import { describe, expect, it } from "vitest";
import { createConsoleClient } from "../../src/api/createConsoleClient";

/** The shape openapi-typescript generates, cut down to one operation. */
type TestPaths = {
  "/v1/ping": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: {
        200: {
          headers: Record<string, unknown>;
          content: { "application/json": { ok: boolean } };
        };
      };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
};

const recorder = () => {
  const requests: Request[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init));
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { requests, fetcher };
};

describe("createConsoleClient", () => {
  it("calls its own agent under the console's path", async () => {
    const { requests, fetcher } = recorder();
    const client = createConsoleClient<TestPaths>({
      key: "minerva/calendar",
      fetch: fetcher,
    });

    await client.GET("/v1/ping");

    expect(requests[0].url).toContain("/minerva/calendar/api/v1/ping");
  });

  it("identifies itself to the agent's request metrics", async () => {
    const { requests, fetcher } = recorder();
    const client = createConsoleClient<TestPaths>({
      key: "minerva/calendar",
      fetch: fetcher,
    });

    await client.GET("/v1/ping");

    expect(requests[0].headers.get(CLIENT_HEADER)).toBe(
      "minerva-calendar-console",
    );
  });

  it("sends the session cookie", async () => {
    const { requests, fetcher } = recorder();
    const client = createConsoleClient<TestPaths>({
      key: "minerva/calendar",
      fetch: fetcher,
    });

    await client.GET("/v1/ping");

    expect(requests[0].credentials).toBe("include");
  });

  it("takes a base URL, for an agent on its own port in the workspace", async () => {
    const { requests, fetcher } = recorder();
    const client = createConsoleClient<TestPaths>({
      key: "minerva/calendar",
      baseUrl: "http://localhost:4432",
      fetch: fetcher,
    });

    await client.GET("/v1/ping");

    expect(requests[0].url).toBe("http://localhost:4432/v1/ping");
  });

  it("refuses a key it cannot read", () => {
    expect(() =>
      createConsoleClient<TestPaths>({ key: "Minerva/Calendar" }),
    ).toThrow(/console key/);
  });

  it("refuses a key whose client name would be too long to send", () => {
    expect(() =>
      createConsoleClient<TestPaths>({ key: `minerva/${"a".repeat(80)}` }),
    ).toThrow(/client name/);
  });
});
