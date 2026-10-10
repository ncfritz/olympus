import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  mayChangeWithCookies,
  sessionCookieNames,
  sessionFromCookies,
  type TokenCheck,
} from "../../../src/consoleSession";

const config = {
  cookiePrefix: "harpocrates",
  baseUrl: "https://control.example/harpocrates/ca/api",
  webAppUrl: "https://control.example/harpocrates/ca",
};
const names = sessionCookieNames(config);
const tokens = { accessToken: "good-new", expiresIn: 300, refreshToken: "r2" };

describe("sessionCookieNames", () => {
  it("names the console's cookies by its prefix", () => {
    expect(names).toEqual({
      access: "harpocrates_access_token",
      refresh: "harpocrates_refresh_token",
      signIn: "harpocrates_sign_in_txn",
    });
  });
});

describe("mayChangeWithCookies", () => {
  it("lets safe methods through from anywhere", () => {
    expect(
      mayChangeWithCookies(
        { method: "GET", headers: { origin: "https://evil.example" } },
        config,
      ),
    ).toBe(true);
  });

  it("lets a change through only from the console's origin", () => {
    expect(
      mayChangeWithCookies(
        { method: "POST", headers: { origin: "https://control.example" } },
        config,
      ),
    ).toBe(true);
    expect(
      mayChangeWithCookies(
        { method: "POST", headers: { origin: "https://other.example" } },
        config,
      ),
    ).toBe(false);
    expect(
      mayChangeWithCookies(
        { method: "POST", headers: { "sec-fetch-site": "same-site" } },
        config,
      ),
    ).toBe(false);
  });
});

describe("sessionFromCookies", () => {
  let verify: Mock<(token: string) => Promise<TokenCheck<{ sub: string }>>>;
  let refresh: Mock;
  let res: { cookie: Mock; clearCookie: Mock };

  beforeEach(() => {
    verify = vi.fn(async (token: string) =>
      token.startsWith("good")
        ? { claims: { sub: token } }
        : { reason: "ERR_JWT_EXPIRED", transient: false },
    );
    refresh = vi.fn(async () => tokens);
    res = { cookie: vi.fn(), clearCookie: vi.fn() };
  });

  const request = (
    cookies: Record<string, string>,
    method = "GET",
    headers: Record<string, string> = {},
  ) => ({ method, headers, cookies });

  it("takes a good access token as it is", async () => {
    const session = await sessionFromCookies(
      request({ [names.access]: "good-1" }),
      res,
      { config, refresh, verify },
    );
    expect(session).toEqual({
      accessToken: "good-1",
      claims: { sub: "good-1" },
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes an expired one and sets both cookies", async () => {
    const session = await sessionFromCookies(
      request({ [names.access]: "old", [names.refresh]: "r1" }),
      res,
      { config, refresh, verify },
    );
    expect(refresh).toHaveBeenCalledWith("r1");
    expect(session.accessToken).toBe("good-new");
    expect(res.cookie.mock.calls.map((call) => call[0])).toEqual([
      names.access,
      names.refresh,
    ]);
    expect(res.cookie.mock.calls[0]?.[2]).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/harpocrates/ca",
    });
  });

  it("clears the cookies when Olympus says the session has ended", async () => {
    refresh.mockRejectedValue(new UnauthorizedException("ended"));
    await expect(
      sessionFromCookies(request({ [names.refresh]: "r1" }), res, {
        config,
        refresh,
        verify,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(res.clearCookie.mock.calls.map((call) => call[0])).toEqual([
      names.access,
      names.refresh,
    ]);
  });

  it("keeps the cookies when Olympus cannot be asked", async () => {
    refresh.mockRejectedValue(new ServiceUnavailableException("down"));
    await expect(
      sessionFromCookies(request({ [names.refresh]: "r1" }), res, {
        config,
        refresh,
        verify,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it("refuses for now when the keys cannot be had, without refreshing", async () => {
    verify.mockResolvedValue({ reason: "ERR_JWKS_TIMEOUT", transient: true });
    await expect(
      sessionFromCookies(
        request({ [names.access]: "x", [names.refresh]: "r1" }),
        res,
        { config, refresh, verify },
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refuses a change from another origin before reading anything", async () => {
    await expect(
      sessionFromCookies(
        request({ [names.access]: "good-1" }, "POST", {
          origin: "https://other.example",
        }),
        res,
        { config, refresh, verify },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(verify).not.toHaveBeenCalled();
  });

  it("refuses with no cookies at all", async () => {
    await expect(
      sessionFromCookies(request({}), res, { config, refresh, verify }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
