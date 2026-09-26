import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { register } from "prom-client";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthGuard } from "../../../src/auth/AuthGuard";
import {
  IS_PUBLIC,
  REQUIRED_ROLES,
  REQUIRES_IDENTITY,
} from "../../../src/auth/authDecorators";
import type {
  RequestWithPrincipal,
  ServicePrincipal,
} from "../../../src/auth/principal";
import type { ServiceIdentity } from "../../../src/auth/services/ServiceIdentityService";
import type { ServiceIdentityService } from "../../../src/auth/services/ServiceIdentityService";
import type {
  UserIdentity,
  UserIdentityService,
} from "../../../src/auth/users/UserIdentityService";
import type {
  AuthConfigType,
  AuthMode,
} from "../../../src/config/configuration";

const AGENT: ServicePrincipal = {
  kind: "service",
  name: "dionysus-asset-agent",
  deployment: "mac-mini",
  roles: ["agent"],
};

/** Metadata the guard reads, as a reflector that returns it directly. */
const reflector = (metadata: Record<string, unknown>) =>
  ({
    getAllAndOverride: (key: string) => metadata[key],
  }) as unknown as Reflector;

const context = (request: Partial<RequestWithPrincipal>) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

const config = (modes: Partial<Record<"users" | "services", AuthMode>> = {}) =>
  ({
    modes: { users: "report", services: "report", ...modes },
    rateLimits: "on",
    serviceRoles: {},
    users: { clientOrigins: [], providers: [] },
    services: {
      enabled: false,
      port: 3443,
      certificate: "",
      key: "",
      ca: "",
      revocationLists: [],
    },
  }) as AuthConfigType;

const guard = (
  identity: ServiceIdentity,
  metadata: Record<string, unknown> = {},
  modes?: Partial<Record<"users" | "services", AuthMode>>,
  /** What the users listener resolves to; its own spec covers the details. */
  userIdentity: UserIdentity = { reason: "no credentials" },
) =>
  new AuthGuard(
    reflector(metadata),
    { identify: () => identity } as unknown as ServiceIdentityService,
    {
      identify: () => Promise.resolve(userIdentity),
    } as unknown as UserIdentityService,
    config(modes),
  );

const request = (over: Partial<RequestWithPrincipal> = {}) =>
  ({
    method: "GET",
    originalUrl: "/v1/olympus/ping",
    ...over,
  }) as RequestWithPrincipal;

const counted = async () => {
  const metric = await register.getSingleMetricAsString("auth_decisions_total");
  return metric
    .split("\n")
    .filter((line) => line.startsWith("auth_decisions_total{"));
};

describe("AuthGuard", () => {
  beforeEach(() => {
    register.getSingleMetric("auth_decisions_total")?.reset();
  });

  it("lets a public route through without a principal", async () => {
    const req = request({ listener: "users" });
    expect(
      await guard(
        { reason: "no credentials" },
        { [IS_PUBLIC]: true },
      ).canActivate(context(req)),
    ).toBe(true);
    expect(req.principal).toBeUndefined();
  });

  it("makes the verified service the request's principal", async () => {
    const req = request({ listener: "services" });
    expect(await guard({ principal: AGENT }).canActivate(context(req))).toBe(
      true,
    );
    expect(req.principal).toEqual(AGENT);
    expect(await counted()).toEqual([
      'auth_decisions_total{listener="services",outcome="allow",reason="none"} 1',
    ]);
  });

  it("serves an unauthenticated request in report mode and counts it", async () => {
    const req = request({ listener: "users" });
    expect(
      await guard({ reason: "no credentials" }).canActivate(context(req)),
    ).toBe(true);
    expect(await counted()).toEqual([
      'auth_decisions_total{listener="users",outcome="would_reject",reason="no credentials"} 1',
    ]);
  });

  it("rejects the same request once the listener enforces", async () => {
    const enforcing = guard(
      { reason: "no credentials" },
      {},
      { users: "enforce" },
    );
    // Async now, so enforcement rejects rather than throws.
    await expect(
      enforcing.canActivate(context(request({ listener: "users" }))),
    ).rejects.toThrow(UnauthorizedException);
    expect(await counted()).toEqual([
      'auth_decisions_total{listener="users",outcome="reject",reason="no credentials"} 1',
    ]);
  });

  it("rejects a RequiresIdentity route in report mode", async () => {
    // Report mode serves what it would refuse, which is right for an
    // endpoint that has a job either way. "Describe the current user" does
    // not: with no principal there is nothing to describe.
    await expect(
      guard(
        { reason: "no credentials" },
        { [REQUIRES_IDENTITY]: true },
      ).canActivate(context(request({ listener: "users" }))),
    ).rejects.toThrow(UnauthorizedException);
    // Counted as a real rejection, not a would_reject: it was one.
    expect(await counted()).toEqual([
      'auth_decisions_total{listener="users",outcome="reject",reason="no credentials"} 1',
    ]);
  });

  it("still reports a role failure on a RequiresIdentity route in report mode", async () => {
    // The principal is there; only the role is missing. RequiresIdentity is
    // about having an identity at all, so this stays a report-mode pass --
    // otherwise adding the decorator would quietly enforce roles too.
    const req = request({ listener: "services" });
    expect(
      await guard(
        { principal: AGENT },
        {
          [REQUIRES_IDENTITY]: true,
          [REQUIRED_ROLES]: ["admin"],
        },
      ).canActivate(context(req)),
    ).toBe(true);
    expect(await counted()).toEqual([
      'auth_decisions_total{listener="services",outcome="would_reject",reason="role"} 1',
    ]);
  });

  it("treats a request without a listener as the users listener", async () => {
    const req = request();
    expect(
      await guard({ reason: "no credentials" }).canActivate(context(req)),
    ).toBe(true);
  });

  it("counts an unknown service without putting its name in the label", async () => {
    await guard({ reason: 'unknown service "olympus-site"' }).canActivate(
      context(request({ listener: "services" })),
    );
    expect(await counted()).toEqual([
      'auth_decisions_total{listener="services",outcome="would_reject",reason="unknown service"} 1',
    ]);
  });

  it("counts a wrong issuer separately from an unknown service", async () => {
    // A device certificate on the services listener: the handshake accepts
    // it, the issuer check does not (ADR 0023). It used to land in `other`.
    await guard({
      reason:
        'issuer "ncfritz.net Device Issuing CA 1 - G1" is not ' +
        '"ncfritz.net Service Issuing CA 1 - G1"',
    }).canActivate(context(request({ listener: "services" })));
    expect(await counted()).toEqual([
      'auth_decisions_total{listener="services",outcome="would_reject",reason="wrong issuer"} 1',
    ]);
  });

  it("allows a principal that has one of the required roles", async () => {
    expect(
      await guard(
        { principal: AGENT },
        { [REQUIRED_ROLES]: ["content", "agent"] },
      ).canActivate(context(request({ listener: "services" }))),
    ).toBe(true);
  });

  it("forbids a principal that has none of them when enforcing", async () => {
    const enforcing = guard(
      { principal: AGENT },
      { [REQUIRED_ROLES]: ["admin"] },
      { services: "enforce" },
    );
    // Async now, so enforcement rejects rather than throws.
    await expect(
      enforcing.canActivate(context(request({ listener: "services" }))),
    ).rejects.toThrow(ForbiddenException);
    expect(await counted()).toEqual([
      'auth_decisions_total{listener="services",outcome="reject",reason="role"} 1',
    ]);
  });

  it("serves the same request in report mode", async () => {
    const req = request({ listener: "services" });
    expect(
      await guard(
        { principal: AGENT },
        { [REQUIRED_ROLES]: ["admin"] },
      ).canActivate(context(req)),
    ).toBe(true);
    // The principal is still on the request: a handler can see who called.
    expect(req.principal).toEqual(AGENT);
  });
});
