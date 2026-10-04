import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "../../../../src/auth/authConstants";
import { JwtAuthGuard } from "../../../../src/auth/guards/JwtAuthGuard";
import type { OlympusTokenVerifier } from "../../../../src/auth/services/OlympusTokenVerifier";
import type { SignInService } from "../../../../src/auth/services/SignInService";
import type { AuthConfigType } from "../../../../src/config/configuration";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN = { userId: "u-1", roles: ["admin"] };

describe("JwtAuthGuard", () => {
  let reflector: { getAllAndOverride: Mock };
  let verifier: { verify: Mock };
  let signIn: { refresh: Mock };
  let guard: JwtAuthGuard;
  let auth: Partial<AuthConfigType>;
  let res: { cookie: Mock; clearCookie: Mock };

  beforeEach(() => {
    auth = {
      baseUrl: "https://control.example/minerva/calendar/api",
      webAppUrl: "https://control.example/minerva/calendar",
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
    verifier = {
      verify: vi.fn(async (token: string) =>
        token.startsWith("good")
          ? { claims: ADMIN }
          : { reason: "ERR_JWT_EXPIRED" },
      ),
    };
    signIn = { refresh: vi.fn() };
    res = { cookie: vi.fn(), clearCookie: vi.fn() };
    guard = new JwtAuthGuard(
      reflector as unknown as Reflector,
      verifier as unknown as OlympusTokenVerifier,
      signIn as unknown as SignInService,
      auth as AuthConfigType,
    );
  });

  function contextFor(req: Record<string, unknown>): ExecutionContext {
    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ExecutionContext;
  }

  const cookieNames = (mock: Mock) => mock.mock.calls.map((call) => call[0]);

  it("allows public routes without a token", async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(
      true,
    );
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("throws Unauthorized when no token is present", async () => {
    await expect(
      guard.canActivate(contextFor({ headers: {}, cookies: {} })),
    ).rejects.toThrow(UnauthorizedException);
    expect(signIn.refresh).not.toHaveBeenCalled();
  });

  it("accepts a Bearer token and attaches the user to the request", async () => {
    const req: Record<string, unknown> = {
      headers: { authorization: "Bearer good-token" },
      cookies: {},
    };

    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith("good-token");
    expect(req.user).toEqual({
      kind: "user",
      userId: "u-1",
      roles: ["admin"],
      accessToken: "good-token",
    });
  });

  it("refuses a Bearer token that does not verify, without refreshing", async () => {
    const req = {
      headers: { authorization: "Bearer stale" },
      cookies: { [REFRESH_TOKEN_COOKIE]: "refresh" },
    };

    await expect(guard.canActivate(contextFor(req))).rejects.toThrow(
      /ERR_JWT_EXPIRED/,
    );
    expect(signIn.refresh).not.toHaveBeenCalled();
  });

  it("refuses a user without the admin role", async () => {
    verifier.verify.mockResolvedValue({
      claims: { userId: "u-2", roles: ["user"] },
    });
    const req = { headers: { authorization: "Bearer good" }, cookies: {} };

    await expect(guard.canActivate(contextFor(req))).rejects.toThrow(
      ForbiddenException,
    );
  });

  describe("the console's cookies", () => {
    it("uses the access token cookie while it verifies", async () => {
      const req: Record<string, unknown> = {
        headers: {},
        cookies: {
          [ACCESS_TOKEN_COOKIE]: "good-cookie",
          [REFRESH_TOKEN_COOKIE]: "refresh",
        },
      };

      await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
      expect(signIn.refresh).not.toHaveBeenCalled();
      expect(req.user).toEqual(
        expect.objectContaining({ accessToken: "good-cookie" }),
      );
    });

    it.each([
      ["has expired", { [ACCESS_TOKEN_COOKIE]: "stale" }],
      ["is gone", {}],
    ])(
      "refreshes when the access token %s, and replaces both cookies",
      async (_what, access) => {
        signIn.refresh.mockResolvedValue({
          accessToken: "good-new",
          expiresIn: 600,
          refreshToken: "refresh-2",
        });
        const req: Record<string, unknown> = {
          headers: {},
          cookies: { ...access, [REFRESH_TOKEN_COOKIE]: "refresh-1" },
        };

        await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
        expect(signIn.refresh).toHaveBeenCalledWith("refresh-1");
        expect(req.user).toEqual(
          expect.objectContaining({ accessToken: "good-new" }),
        );
        expect(res.cookie.mock.calls).toEqual([
          [
            ACCESS_TOKEN_COOKIE,
            "good-new",
            expect.objectContaining({
              httpOnly: true,
              path: "/minerva/calendar",
              maxAge: 600_000,
            }),
          ],
          [
            REFRESH_TOKEN_COOKIE,
            "refresh-2",
            expect.objectContaining({
              httpOnly: true,
              path: "/minerva/calendar",
            }),
          ],
        ]);
      },
    );

    it("clears both cookies when the API will not refresh", async () => {
      signIn.refresh.mockRejectedValue(new UnauthorizedException("ended"));
      const req = {
        headers: {},
        cookies: {
          [ACCESS_TOKEN_COOKIE]: "stale",
          [REFRESH_TOKEN_COOKIE]: "refresh",
        },
      };

      await expect(guard.canActivate(contextFor(req))).rejects.toThrow(
        UnauthorizedException,
      );
      expect(cookieNames(res.clearCookie)).toEqual([
        ACCESS_TOKEN_COOKIE,
        REFRESH_TOKEN_COOKIE,
      ]);
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it("still requires the admin role of a refreshed token", async () => {
      signIn.refresh.mockResolvedValue({
        accessToken: "good-new",
        expiresIn: 600,
        refreshToken: "refresh-2",
      });
      verifier.verify.mockImplementation(async (token: string) =>
        token === "good-new"
          ? { claims: { userId: "u-1", roles: [] } }
          : { reason: "ERR_JWT_EXPIRED" },
      );
      const req = {
        headers: {},
        cookies: { [REFRESH_TOKEN_COOKIE]: "refresh" },
      };

      await expect(guard.canActivate(contextFor(req))).rejects.toThrow(
        ForbiddenException,
      );
    });
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

    it("attaches the allowed service its certificate names", async () => {
      const req = serviceRequest(api);

      await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
      expect(req.user).toEqual({ kind: "service", name: "olympus-api" });
    });

    it("reads no token there, even a valid one", async () => {
      const req = serviceRequest(api, {
        headers: { authorization: "Bearer good-token" },
      });

      await guard.canActivate(contextFor(req));
      expect(verifier.verify).not.toHaveBeenCalled();
      expect(req.user).toEqual({ kind: "service", name: "olympus-api" });
    });

    it("refuses a service that is not allowed to call", async () => {
      await expect(
        guard.canActivate(
          contextFor(
            serviceRequest({ ...api, subject: { CN: "dionysus-asset-agent" } }),
          ),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("refuses a certificate from another issuer", async () => {
      await expect(
        guard.canActivate(
          contextFor(
            serviceRequest({ ...api, issuer: { CN: "Device Issuing CA" } }),
          ),
        ),
      ).rejects.toThrow(/issuer "Device Issuing CA"/);
    });

    it("refuses a request with no certificate", async () => {
      await expect(
        guard.canActivate(contextFor(serviceRequest({}))),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("never reads a certificate on the HTTP listener", async () => {
      const req = {
        headers: {},
        cookies: {},
        socket: { getPeerCertificate: () => api },
      };

      await expect(guard.canActivate(contextFor(req))).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  it("refuses a signed-in user on a route only a service may call", async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === "servicesOnly" ? true : false,
    );
    const req = {
      headers: { authorization: "Bearer good-token" },
      cookies: {},
    };

    await expect(guard.canActivate(contextFor(req))).rejects.toThrow(
      /Only the Olympus API/,
    );
  });
});
