import { describe, expect, it, vi } from "vitest";
import {
  clientNameFor,
  createMutualTlsAdapter,
  isClientName,
  requestBody,
  requestHeaders,
  requestUrl,
  type ServiceAnswer,
} from "../../src/mutualTls";

const answered = (answer: Partial<ServiceAnswer> = {}): ServiceAnswer => ({
  status: 200,
  headers: {},
  body: "",
  ...answer,
});

describe("requestUrl", () => {
  /** What the SDK does: the base URL is already in `url`, and `baseURL` is empty. */
  it("takes an absolute url as it is", () => {
    expect(
      requestUrl({ baseURL: "", url: "https://host:3443/v1/olympus/ping" }),
    ).toBe("https://host:3443/v1/olympus/ping");
  });

  it("joins a relative url to the base URL with one slash", () => {
    expect(
      requestUrl({ baseURL: "https://host:3443/v1/", url: "/olympus/ping" }),
    ).toBe("https://host:3443/v1/olympus/ping");
    expect(
      requestUrl({ baseURL: "https://host:3443/v1", url: "olympus/ping" }),
    ).toBe("https://host:3443/v1/olympus/ping");
  });

  it("is the base URL alone when there is no path", () => {
    expect(requestUrl({ baseURL: "https://host:3443/v1" })).toBe(
      "https://host:3443/v1",
    );
  });

  it("appends params, and keeps a query the url already has", () => {
    expect(
      requestUrl({ url: "https://host/v1/search", params: { q: "a b", n: 2 } }),
    ).toBe("https://host/v1/search?q=a%20b&n=2");
    expect(
      requestUrl({ url: "https://host/v1/search?q=1", params: { n: 2 } }),
    ).toBe("https://host/v1/search?q=1&n=2");
  });

  it("repeats a name for an array, and drops what is not there", () => {
    expect(
      requestUrl({
        url: "https://host/v1/media",
        params: { tag: ["a", "b"], missing: undefined, empty: null },
      }),
    ).toBe("https://host/v1/media?tag=a&tag=b");
  });
});

describe("requestHeaders", () => {
  it("reads axios's own headers through toJSON", () => {
    expect(
      requestHeaders({
        toJSON: () => ({ "x-olympus-client": "dionysus-search-agent" }),
      }),
    ).toEqual({ "x-olympus-client": "dionysus-search-agent" });
  });

  it("takes a plain object, joins a repeated header and drops empties", () => {
    expect(
      requestHeaders({ accept: "application/json", cookie: undefined }),
    ).toEqual({ accept: "application/json" });
    expect(requestHeaders({ vary: ["accept", "origin"] })).toEqual({
      vary: "accept, origin",
    });
  });

  it("is empty when there are none", () => {
    expect(requestHeaders(undefined)).toEqual({});
  });
});

describe("requestBody", () => {
  /** Axios has already serialized a JSON body by the time an adapter sees it. */
  it("passes a string through and leaves nothing as nothing", () => {
    expect(requestBody('{"a":1}')).toBe('{"a":1}');
    expect(requestBody(undefined)).toBeUndefined();
    expect(requestBody(null)).toBeUndefined();
  });

  it("serializes an object, which is the only thing it could have meant", () => {
    expect(requestBody({ a: 1 })).toBe('{"a":1}');
  });

  it("refuses a form rather than sending an empty one", () => {
    expect(() => requestBody({ append: () => undefined })).toThrow(/form/);
  });
});

describe("the adapter", () => {
  it("makes the request natively, in seconds, and leaves the body as text", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        answered({ body: '{"ok":true}', headers: { "content-type": "a/b" } }),
      );
    const response = await createMutualTlsAdapter(request)({
      baseURL: "",
      url: "https://host:3443/v1/olympus/ping",
      method: "get",
      headers: { accept: "application/json" },
      timeout: 5000,
    });

    expect(request).toHaveBeenCalledWith({
      url: "https://host:3443/v1/olympus/ping",
      method: "GET",
      headers: { accept: "application/json" },
      timeout: 5,
    });
    // Axios runs its own transformResponse on whatever an adapter resolves;
    // parsing here as well would parse it twice.
    expect(response.data).toBe('{"ok":true}');
    expect(response.status).toBe(200);
    expect(response.headers).toEqual({ "content-type": "a/b" });
  });

  it("sends no timeout when there is none to send", async () => {
    const request = vi.fn().mockResolvedValue(answered());
    await createMutualTlsAdapter(request)({ url: "https://host/v1/x" });
    expect(request).toHaveBeenCalledWith({
      url: "https://host/v1/x",
      method: "GET",
      headers: {},
    });
  });

  it("rejects with an axios-shaped failure the caller can read a status from", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(answered({ status: 403, body: "Forbidden" }));
    const adapter = createMutualTlsAdapter(request);
    await expect(
      adapter({
        url: "https://host:3443/v1/olympus/ping",
        validateStatus: (status) => status < 400,
      }),
    ).rejects.toMatchObject({
      isAxiosError: true,
      status: 403,
      response: { status: 403, data: "Forbidden" },
    });
  });

  /** `validateStatus: () => true`, and axios's own "null means every status". */
  it("resolves for any status when nothing validates it", async () => {
    const request = vi.fn().mockResolvedValue(answered({ status: 403 }));
    const adapter = createMutualTlsAdapter(request);
    await expect(
      adapter({ url: "https://host/v1/x", validateStatus: null }),
    ).resolves.toMatchObject({ status: 403 });
    await expect(
      adapter({ url: "https://host/v1/x", validateStatus: () => true }),
    ).resolves.toMatchObject({ status: 403 });
  });

  /** A refused handshake has no status: the listener never accepted the caller. */
  it("lets a transport failure through as it is", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(
        new Error("The certificate for this server is invalid"),
      );
    await expect(
      createMutualTlsAdapter(request)({ url: "https://host:3443/v1/x" }),
    ).rejects.toThrow("The certificate for this server is invalid");
  });
});

describe("clientNameFor", () => {
  it("is the common name when the common name is already usable", () => {
    expect(clientNameFor("dionysus-search-agent")).toBe(
      "dionysus-search-agent",
    );
  });

  it("makes a label out of a subject that reads like a title", () => {
    expect(clientNameFor("Olympus API")).toBe("olympus-api");
    expect(clientNameFor("olympus.notification.agent")).toBe(
      "olympus-notification-agent",
    );
  });

  it("is nothing when there is nothing usable in it", () => {
    expect(clientNameFor("")).toBeUndefined();
    expect(clientNameFor("123")).toBeUndefined();
    expect(clientNameFor("---")).toBeUndefined();
  });
});

describe("isClientName", () => {
  it("is what the metrics label allows, and no more", () => {
    expect(isClientName("olympus-api")).toBe(true);
    expect(isClientName("Olympus")).toBe(false);
    expect(isClientName("1-agent")).toBe(false);
    expect(isClientName("")).toBe(false);
  });
});
