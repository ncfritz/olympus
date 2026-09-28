import { describe, expect, it } from "vitest";
import { timed } from "../../src/called";

describe("timed", () => {
  it("reports a plain answer as a 200, as JSON", async () => {
    const called = await timed("GET", "/auth/me", () =>
      Promise.resolve({ sub: "someone" }),
    );
    expect(called.status).toBe(200);
    expect(called.answer).toBe('{"sub":"someone"}');
    expect(called.method).toBe("GET");
    expect(called.path).toBe("/auth/me");
    expect(called.took).toBeGreaterThanOrEqual(0);
  });

  /** A raw request with `validateStatus: () => true` answers for itself. */
  it("takes the status from an answer that carries one", async () => {
    const called = await timed("GET", "/ping", () =>
      Promise.resolve({
        status: 404,
        body: { message: "Cannot GET /v1/ping" },
      }),
    );
    expect(called.status).toBe(404);
    expect(called.answer).toBe('{"message":"Cannot GET /v1/ping"}');
  });

  it("reports the status and the body of a rejection that has them", async () => {
    const called = await timed("GET", "/auth/me", () =>
      Promise.reject({ response: { status: 401, data: { error: "expired" } } }),
    );
    expect(called.status).toBe(401);
    expect(called.answer).toBe('{"error":"expired"}');
  });

  /** A transport failure has no status; the message is the whole account of it. */
  it("reports a failure with no response as its message", async () => {
    const called = await timed("GET", "/olympus/ping", () =>
      Promise.reject(new Error("The certificate for this server is invalid")),
    );
    expect(called.status).toBeUndefined();
    expect(called.answer).toBe("The certificate for this server is invalid");
  });

  it("leaves a text body as text rather than quoting it", async () => {
    const called = await timed("GET", "/olympus/ping", () =>
      Promise.reject({ response: { status: 403, data: "Forbidden" } }),
    );
    expect(called.answer).toBe("Forbidden");
  });

  it("says so when there is no body at all", async () => {
    const called = await timed("POST", "/auth/logout", () =>
      Promise.resolve(undefined),
    );
    expect(called.answer).toBe("(no body)");
  });
});
