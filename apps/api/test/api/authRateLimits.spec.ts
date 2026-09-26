import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUTH_LIMITS } from "../../src/auth/limits/rateLimits";
import { createTestApp, type TestApp } from "../support/testApp";

/**
 * The limits on the auth endpoints, against the real routes.
 *
 * Deliberately with requests the controller refuses anyway: the limiter runs
 * before it, so a malformed request counts — otherwise the limit would be
 * bypassed by sending rubbish. Everything about the counting itself is in
 * RateLimiter.spec; this is about the guard being wired to these routes,
 * with these numbers, and answering the way a client can act on.
 */
describe("the auth endpoints' rate limits", () => {
  let t: TestApp;

  beforeAll(async () => {
    // On is the default; named here because the point of the spec is that it
    // is on, and signIn.spec runs with it off.
    t = await createTestApp({ env: { AUTH_RATE_LIMITS: "on" } });
  });

  afterAll(async () => {
    await t.close();
  });

  const authorize = () => t.http().get("/v1/auth/authorize");

  it("counts a request the endpoint was going to refuse anyway", async () => {
    const limit = AUTH_LIMITS.beginSignIn.perClient;
    for (let i = 0; i < limit; i += 1) {
      // No parameters at all, so each is a 400 from the controller.
      expect((await authorize()).status).toBe(400);
    }

    const over = await authorize();
    expect(over.status).toBe(429);
    // What a client can act on, and the reason a 429 is the answer here
    // rather than an OAuth error: every HTTP client already understands it.
    expect(over.headers["retry-after"]).toBe(
      String(AUTH_LIMITS.beginSignIn.windowSeconds),
    );
  });

  it("counts each endpoint separately", async () => {
    // beginSignIn's window is spent by the test above. The token endpoint has
    // its own, so exhausting one must not close the other.
    const res = await t.http().post("/v1/auth/token").type("form").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("unsupported_grant_type");
  });

  it("records the refusal, by endpoint and scope", async () => {
    const metrics = (await t.http().get("/metrics").expect(200)).text;
    expect(metrics).toMatch(
      /^auth_rate_limited_total\{[^}]*endpoint="BeginSignInController",scope="client"[^}]*\} [1-9]/m,
    );
  });
});
