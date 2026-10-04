import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountMismatchError } from "../../../../src/calendarAuth/AccountMismatchError";
import { GoogleAuthStrategy } from "../../../../src/calendarAuth/strategies/GoogleAuthStrategy";
import { MicrosoftAuthStrategy } from "../../../../src/calendarAuth/strategies/MicrosoftAuthStrategy";
import type { GoogleCredentialStore } from "../../../../src/providers/google/GoogleCredentialStore";
import type { MicrosoftCredentialStore } from "../../../../src/providers/microsoft/MicrosoftCredentialStore";
import * as microsoftOauth from "../../../../src/providers/microsoft/microsoftOauth";

const googleClient = {
  generateAuthUrl: vi.fn(),
  getToken: vi.fn(),
  getTokenInfo: vi.fn(),
};
const OAuth2Client = vi.fn((...args: unknown[]) => {
  void args;
  return googleClient;
});

vi.mock("google-auth-library", async (importOriginal) => ({
  ...(await importOriginal<typeof import("google-auth-library")>()),
  OAuth2Client: vi.fn(function (...args: unknown[]) {
    return OAuth2Client(...args);
  }),
}));
vi.mock(
  "../../../../src/providers/microsoft/microsoftOauth",
  async (importOriginal) => ({
    ...(await importOriginal<typeof microsoftOauth>()),
    buildMicrosoftWebAuthUrl: vi.fn(),
    completeMicrosoftWebSignIn: vi.fn(),
  }),
);
const mockedMicrosoftOauth = vi.mocked(microsoftOauth);

const REDIRECT =
  "https://olympus.example/api/v1/minerva/calendar-accounts/callback/google";
const STATE = "state-0123456789abcdef";
const VERIFIER = "v".repeat(43);
const callback = (query: string, accountLabel?: string) => ({
  callbackUrl: `${REDIRECT}?${query}`,
  redirectUri: REDIRECT,
  state: STATE,
  codeVerifier: VERIFIER,
  accountLabel,
});

describe("web sign-ins (ADR 0028)", () => {
  const googleStore = {
    tryLoad: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    oauthClient: vi.fn(),
  };
  const microsoftStore = { tryLoad: vi.fn(), save: vi.fn(), remove: vi.fn() };
  const google = () =>
    new GoogleAuthStrategy(googleStore as unknown as GoogleCredentialStore);
  const microsoft = () =>
    new MicrosoftAuthStrategy(
      microsoftStore as unknown as MicrosoftCredentialStore,
      {
        clientId: "ms-client",
        clientSecret: "ms-secret",
        tenantId: "common",
        credentialsDir: "",
      },
    );

  beforeEach(() => {
    vi.clearAllMocks();
    googleStore.oauthClient.mockReturnValue({
      clientId: "web-client",
      clientSecret: "web-secret",
    });
    googleStore.tryLoad.mockReturnValue(undefined);
    microsoftStore.tryLoad.mockReturnValue(undefined);
    googleClient.getToken.mockResolvedValue({
      tokens: {
        refresh_token: "refresh",
        access_token: "access",
        scope: "scope",
      },
    });
    googleClient.getTokenInfo.mockResolvedValue({
      sub: "google-sub-new",
      email: "new@example.com",
      email_verified: true,
    });
  });

  describe("Google", () => {
    it("starts at Google with the web client, the API's state and PKCE challenge", async () => {
      googleClient.generateAuthUrl.mockReturnValue(
        "https://accounts.google.com/x",
      );

      const url = await google().startWebSignIn({
        redirectUri: REDIRECT,
        state: STATE,
        codeChallenge: "c".repeat(43),
        loginHint: "me@example.com",
      });

      expect(url).toBe("https://accounts.google.com/x");
      expect(googleStore.oauthClient).toHaveBeenCalledWith("web");
      expect(OAuth2Client).toHaveBeenCalledWith(
        "web-client",
        "web-secret",
        REDIRECT,
      );
      expect(googleClient.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: "offline",
          prompt: "consent",
          state: STATE,
          code_challenge: "c".repeat(43),
          code_challenge_method: "S256",
          login_hint: "me@example.com",
          scope: expect.arrayContaining(["openid"]),
        }),
      );
    });

    it("redeems a new account's redirect and keeps it as the web client's", async () => {
      const result = await google().completeWebSignIn(
        callback(`code=the-code&state=${STATE}`),
      );

      expect(googleClient.getToken).toHaveBeenCalledWith({
        code: "the-code",
        codeVerifier: VERIFIER,
        redirect_uri: REDIRECT,
      });
      expect(result).toEqual({
        accountLabel: "new@example.com",
        subject: "google-sub-new",
        created: true,
      });
      expect(googleStore.save).toHaveBeenCalledWith(
        expect.objectContaining({
          accountLabel: "new@example.com",
          refreshToken: "refresh",
          subject: "google-sub-new",
          client: "web",
        }),
      );
    });

    it("reports an account it already held as not created", async () => {
      googleStore.tryLoad.mockReturnValue({ subject: "google-sub-new" });

      const result = await google().completeWebSignIn(
        callback(`code=the-code&state=${STATE}`),
      );

      expect(result.created).toBe(false);
    });

    it.each([
      [
        "another state",
        `code=the-code&state=someone-elses-state`,
        /state does not match/,
      ],
      ["an error", `error=access_denied&state=${STATE}`, /access_denied/],
      ["no code", `state=${STATE}`, /no code/],
    ])(
      "refuses a redirect with %s before redeeming anything",
      async (_, query, error) => {
        await expect(
          google().completeWebSignIn(callback(query)),
        ).rejects.toThrow(error);
        expect(googleClient.getToken).not.toHaveBeenCalled();
        expect(googleStore.save).not.toHaveBeenCalled();
      },
    );

    it("refuses another account signing in again, keeping the stored credential", async () => {
      googleStore.tryLoad.mockReturnValue({ subject: "google-sub-me" });

      await expect(
        google().completeWebSignIn(
          callback(`code=the-code&state=${STATE}`, "me@example.com"),
        ),
      ).rejects.toThrow(AccountMismatchError);
      expect(googleStore.save).not.toHaveBeenCalled();
    });
  });

  describe("Microsoft", () => {
    it("redeems a new account's redirect and keeps it as the web platform's", async () => {
      mockedMicrosoftOauth.completeMicrosoftWebSignIn.mockResolvedValue({
        refreshToken: "ms-refresh",
        scope: "scope",
        email: "me@work.example",
        subject: "tid:oid",
      });

      const result = await microsoft().completeWebSignIn(
        callback(`code=the-code&state=${STATE}`),
      );

      expect(result).toEqual({
        accountLabel: "me@work.example",
        subject: "tid:oid",
        created: true,
      });
      expect(microsoftStore.save).toHaveBeenCalledWith(
        expect.objectContaining({
          accountLabel: "me@work.example",
          subject: "tid:oid",
          client: "web",
        }),
      );
    });

    it("refuses another account signing in again", async () => {
      microsoftStore.tryLoad.mockReturnValue({ subject: "tid:oid" });
      mockedMicrosoftOauth.completeMicrosoftWebSignIn.mockResolvedValue({
        refreshToken: "ms-refresh",
        scope: "scope",
        email: "me@work.example",
        subject: "tid:someone-else",
      });

      await expect(
        microsoft().completeWebSignIn(
          callback(`code=the-code&state=${STATE}`, "me@work.example"),
        ),
      ).rejects.toThrow(AccountMismatchError);
      expect(microsoftStore.save).not.toHaveBeenCalled();
    });
  });
});
