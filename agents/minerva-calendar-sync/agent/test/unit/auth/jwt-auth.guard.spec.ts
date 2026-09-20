import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AllowlistService } from "../../../src/auth/allowlist.service";
import { AuthTokenService } from "../../../src/auth/auth-token.service";
import { ACCESS_TOKEN_COOKIE } from "../../../src/auth/auth.constants";
import { JwtAuthGuard } from "../../../src/auth/jwt-auth.guard";

describe("JwtAuthGuard", () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let tokens: { verifyAccessToken: jest.Mock };
  let allowlist: { isAllowed: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    tokens = { verifyAccessToken: jest.fn() };
    allowlist = { isAllowed: jest.fn().mockReturnValue(true) };
    guard = new JwtAuthGuard(
      reflector as unknown as Reflector,
      tokens as unknown as AuthTokenService,
      allowlist as unknown as AllowlistService,
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
    expect(() => guard.canActivate(contextFor({ headers: {}, cookies: {} }))).toThrow(UnauthorizedException);
  });

  it("accepts a Bearer token and attaches the user to the request", () => {
    tokens.verifyAccessToken.mockReturnValue("me@example.com");
    const req: Record<string, unknown> = { headers: { authorization: "Bearer good-token" }, cookies: {} };

    expect(guard.canActivate(contextFor(req))).toBe(true);
    expect(tokens.verifyAccessToken).toHaveBeenCalledWith("good-token");
    expect(req.user).toEqual({ email: "me@example.com" });
  });

  it("falls back to the access-token cookie when there is no Authorization header", () => {
    tokens.verifyAccessToken.mockReturnValue("me@example.com");
    const req = { headers: {}, cookies: { [ACCESS_TOKEN_COOKIE]: "cookie-token" } };

    expect(guard.canActivate(contextFor(req))).toBe(true);
    expect(tokens.verifyAccessToken).toHaveBeenCalledWith("cookie-token");
  });

  it("throws Forbidden when the verified email is not on the allowlist", () => {
    tokens.verifyAccessToken.mockReturnValue("me@example.com");
    allowlist.isAllowed.mockReturnValue(false);
    const req = { headers: { authorization: "Bearer good-token" }, cookies: {} };

    expect(() => guard.canActivate(contextFor(req))).toThrow(ForbiddenException);
  });

  it("propagates the token service's own rejection", () => {
    tokens.verifyAccessToken.mockImplementation(() => {
      throw new UnauthorizedException("bad token");
    });
    const req = { headers: { authorization: "Bearer bad" }, cookies: {} };

    expect(() => guard.canActivate(contextFor(req))).toThrow(UnauthorizedException);
  });
});
