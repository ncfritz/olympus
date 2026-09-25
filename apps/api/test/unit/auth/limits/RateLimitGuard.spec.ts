import type { ExecutionContext } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { register } from "prom-client";
import { beforeEach, describe, expect, it } from "vitest";
import { RateLimitGuard } from "../../../../src/auth/limits/RateLimitGuard";
import {
  AUTH_LIMITS,
  RATE_LIMIT,
} from "../../../../src/auth/limits/rateLimits";
import type { RateLimit } from "../../../../src/auth/limits/RateLimiter";

const LIMIT: RateLimit = { perClient: 2, global: 10, windowSeconds: 60 };

/** The headers a refusal sets, captured. */
interface Captured {
  headers: Record<string, string>;
}

/** The limit comes from the reflector, so it is not a parameter here. */
const context = (
  ip: string | undefined,
  captured: Captured,
  className = "BeginSignInController",
  handlerName = "handle",
) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ ip, method: "GET", originalUrl: "/v1/authorize" }),
      getResponse: () => ({
        setHeader: (name: string, value: string) => {
          captured.headers[name] = value;
        },
      }),
    }),
    getHandler: () => ({ name: handlerName }),
    getClass: () => ({ name: className }),
  }) as unknown as ExecutionContext;

const reflector = (limit: RateLimit | undefined) =>
  ({
    getAllAndOverride: (key: string) =>
      key === RATE_LIMIT ? limit : undefined,
  }) as unknown as Reflector;

/** prom-client's `get()` is async, so this is too. */
const counted = async (endpoint: string, scope: string): Promise<number> => {
  const metric = register.getSingleMetric("auth_rate_limited_total") as
    | undefined
    | {
        get: () => Promise<{
          values: { labels: Record<string, string>; value: number }[];
        }>;
      };
  if (metric === undefined) return 0;
  const { values } = await metric.get();
  return values
    .filter((v) => v.labels.endpoint === endpoint && v.labels.scope === scope)
    .reduce((total, v) => total + v.value, 0);
};

describe("RateLimitGuard", () => {
  let captured: Captured;

  beforeEach(() => {
    captured = { headers: {} };
    register.resetMetrics();
  });

  it("lets a route with no limit through", () => {
    const guard = new RateLimitGuard(reflector(undefined));
    for (let i = 0; i < 100; i += 1) {
      expect(guard.canActivate(context("10.0.0.1", captured))).toBe(true);
    }
  });

  it("allows requests up to the limit", () => {
    const guard = new RateLimitGuard(reflector(LIMIT));
    expect(guard.canActivate(context("10.0.0.1", captured))).toBe(true);
    expect(guard.canActivate(context("10.0.0.1", captured))).toBe(true);
  });

  it("answers 429 with Retry-After once over it", () => {
    const guard = new RateLimitGuard(reflector(LIMIT));
    guard.canActivate(context("10.0.0.1", captured));
    guard.canActivate(context("10.0.0.1", captured));
    let thrown: unknown;
    try {
      guard.canActivate(context("10.0.0.1", captured));
    } catch (error: unknown) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(429);
    expect(captured.headers["Retry-After"]).toBe("60");
  });

  it("counts the refusal, by endpoint and scope", async () => {
    const guard = new RateLimitGuard(reflector(LIMIT));
    guard.canActivate(context("10.0.0.1", captured));
    guard.canActivate(context("10.0.0.1", captured));
    expect(() => guard.canActivate(context("10.0.0.1", captured))).toThrow();
    expect(await counted("BeginSignInController", "client")).toBe(1);
    expect(await counted("BeginSignInController", "global")).toBe(0);
  });

  it("counts addresses separately", () => {
    const guard = new RateLimitGuard(reflector(LIMIT));
    guard.canActivate(context("10.0.0.1", captured));
    guard.canActivate(context("10.0.0.1", captured));
    expect(() => guard.canActivate(context("10.0.0.1", captured))).toThrow();
    expect(guard.canActivate(context("10.0.0.2", captured))).toBe(true);
  });

  it("counts handlers separately, so one endpoint cannot exhaust another", () => {
    const guard = new RateLimitGuard(reflector(LIMIT));
    const one = () =>
      guard.canActivate(context("10.0.0.1", captured, "BeginSignInController"));
    one();
    one();
    expect(one).toThrow();
    expect(
      guard.canActivate(context("10.0.0.1", captured, "CreateTokenController")),
    ).toBe(true);
  });

  it("puts every request with no address in one bucket", () => {
    // Which is the point: a missing address is not a free pass.
    const guard = new RateLimitGuard(reflector(LIMIT));
    guard.canActivate(context(undefined, captured));
    guard.canActivate(context(undefined, captured));
    expect(() => guard.canActivate(context(undefined, captured))).toThrow(
      HttpException,
    );
  });

  it("refuses on the ceiling, with the global scope, before any client is over", async () => {
    const ceiling: RateLimit = {
      perClient: 5,
      global: 2,
      windowSeconds: 60,
    };
    const guard = new RateLimitGuard(reflector(ceiling));
    expect(guard.canActivate(context("10.0.0.1", captured))).toBe(true);
    expect(guard.canActivate(context("10.0.0.2", captured))).toBe(true);
    expect(() => guard.canActivate(context("10.0.0.3", captured))).toThrow(
      HttpException,
    );
    expect(await counted("BeginSignInController", "global")).toBe(1);
    expect(await counted("BeginSignInController", "client")).toBe(0);
  });
});

describe("AUTH_LIMITS", () => {
  it("never lets one client exhaust the ceiling on its own", () => {
    // Otherwise the ceiling is not a ceiling: it is a second per-client
    // limit, and one caller can lock everyone else out.
    for (const [name, limit] of Object.entries(AUTH_LIMITS)) {
      expect(limit.perClient, name).toBeLessThan(limit.global);
    }
  });

  it("allows more token requests than sign-ins", () => {
    // Refreshing is routine; signing in is not.
    expect(AUTH_LIMITS.createToken.perClient).toBeGreaterThan(
      AUTH_LIMITS.beginSignIn.perClient,
    );
  });
});
