import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AllowlistService } from "../../../../src/auth/services/AllowlistService";
import { AuthTokenService } from "../../../../src/auth/services/AuthTokenService";
import { ACCESS_TOKEN_COOKIE } from "../../../../src/auth/authConstants";
import { JwtAuthGuard } from "../../../../src/auth/guards/JwtAuthGuard";
import type { AuthConfigType } from "../../../../src/config/configuration";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

describe("JwtAuthGuard", () => {
  let reflector: { getAllAndOverride: Mock };
  let tokens: { verifyAccessToken: Mock };
  let allowlist: { isAllowed: Mock };
  let guard: JwtAuthGuard;
  let auth: Partial<AuthConfigType>;

  beforeEach(() => {
    auth = {
      services: {
        port: 4433,
        certificate: "",
        key: "",
        ca: "",
        revocationLists: [],
        issuer: "Service Issuing CA",
        clients: ["olympus-api"],
      },
    };
    reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    tokens = { verifyAccessToken: vi.fn() };
    allowlist = { isAllowed: vi.fn().mockReturnValue(true) };
    guard = new JwtAuthGuard(
      reflector as unknown as Reflector,
      tokens as unknown as AuthTokenService,
      allowlist as unknown as AllowlistService,
      auth as AuthConfigType,
    );
  });

  function contextFor(req: Record<string, unknown>): ExecutionContext {
    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  }

  it("allows public routes without a token", () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    expect(guard.canActivate(contextFor({ headers: {} }))).toBe(true);
    expect(tokens.verifyAccessToken).not.toHaveBeenCalled();
  });

  it("throws Unauthorized when no token is present", () => {
    expect(() =>
      guard.canActivate(contextFor({ headers: {}, cookies: {} })),
    ).toThrow(UnauthorizedException);
  });

  it("accepts a Bearer token and attaches the user to the request", () => {
    tokens.verifyAccessToken.mockReturnValue("me@example.com");
    const req: Record<string, unknown> = {
      headers: { authorization: "Bearer good-token" },
      cookies: {},
    };

    expect(guard.canActivate(contextFor(req))).toBe(true);
    expect(tokens.verifyAccessToken).toHaveBeenCalledWith("good-token");
    expect(req.user).toEqual({ kind: "user", email: "me@example.com" });
  });

  it("falls back to the access-token cookie when there is no Authorization header", () => {
    tokens.verifyAccessToken.mockReturnValue("me@example.com");
    const req = {
      headers: {},
      cookies: { [ACCESS_TOKEN_COOKIE]: "cookie-token" },
    };

    expect(guard.canActivate(contextFor(req))).toBe(true);
    expect(tokens.verifyAccessToken).toHaveBeenCalledWith("cookie-token");
  });

  it("throws Forbidden when the verified email is not on the allowlist", () => {
    tokens.verifyAccessToken.mockReturnValue("me@example.com");
    allowlist.isAllowed.mockReturnValue(false);
    const req = {
      headers: { authorization: "Bearer good-token" },
      cookies: {},
    };

    expect(() => guard.canActivate(contextFor(req))).toThrow(
      ForbiddenException,
    );
  });

  it("propagates the token service's own rejection", () => {
    tokens.verifyAccessToken.mockImplementation(() => {
      throw new UnauthorizedException("bad token");
    });
    const req = { headers: { authorization: "Bearer bad" }, cookies: {} };

    expect(() => guard.canActivate(contextFor(req))).toThrow(
      UnauthorizedException,
    );
  });

  describe("on the services listener", () => {
    const serviceRequest = (
      certificate: unknown,
      extra: Record<string, unknown> = {},
    ): Record<string, unknown> => ({
      listener: "services",
      headers: {},
      cookies: {},
      socket: { getPeerCertificate: () => certificate },
      ...extra,
    });
    const api = {
      subject: { CN: "olympus-api", OU: "prod" },
      issuer: { CN: "Service Issuing CA" },
    };

    it("attaches the allowed service its certificate names", () => {
      const req = serviceRequest(api);

      expect(guard.canActivate(contextFor(req))).toBe(true);
      expect(req.user).toEqual({ kind: "service", name: "olympus-api" });
    });

    it("reads no token there, even a valid one", () => {
      tokens.verifyAccessToken.mockReturnValue("me@example.com");
      const req = serviceRequest(api, {
        headers: { authorization: "Bearer good-token" },
      });

      guard.canActivate(contextFor(req));
      expect(tokens.verifyAccessToken).not.toHaveBeenCalled();
      expect(req.user).toEqual({ kind: "service", name: "olympus-api" });
    });

    it("refuses a service that is not allowed to call", () => {
      expect(() =>
        guard.canActivate(
          contextFor(
            serviceRequest({ ...api, subject: { CN: "dionysus-asset-agent" } }),
          ),
        ),
      ).toThrow(ForbiddenException);
    });

    it("refuses a certificate from another issuer", () => {
      expect(() =>
        guard.canActivate(
          contextFor(
            serviceRequest({ ...api, issuer: { CN: "Device Issuing CA" } }),
          ),
        ),
      ).toThrow(/issuer "Device Issuing CA"/);
    });

    it("refuses a request with no certificate", () => {
      expect(() => guard.canActivate(contextFor(serviceRequest({})))).toThrow(
        UnauthorizedException,
      );
    });

    it("never reads a certificate on the HTTP listener", () => {
      const req = {
        headers: {},
        cookies: {},
        socket: { getPeerCertificate: () => api },
      };

      expect(() => guard.canActivate(contextFor(req))).toThrow(
        UnauthorizedException,
      );
    });
  });
});
