import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GMAIL_READ_SCOPES } from "../../../src/config/configuration";
import { GmailAccountMismatchError } from "../../../src/gmail/GmailAccountMismatchError";
import { GmailAuth } from "../../../src/gmail/GmailAuth";
import { GmailCredentialStore } from "../../../src/gmail/GmailCredentialStore";

const REDIRECT =
  "https://olympus.example.test/api/v1/minerva/mail/accounts/callback";
const EMAIL = "neil@example.test";

/** A stand-in for google-auth-library's OAuth2Client. */
const client = (info: Record<string, unknown>, refresh = "refresh-1") => ({
  generateAuthUrl: vi.fn(
    (options: Record<string, unknown>) =>
      `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(
        Object.entries(options).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.join(" ") : String(v),
        ]),
      )}`,
  ),
  getToken: vi.fn(async () => ({
    tokens: {
      refresh_token: refresh,
      access_token: "access-1",
      scope: GMAIL_READ_SCOPES.join(" "),
    },
  })),
  getTokenInfo: vi.fn(async () => info),
});

describe("GmailAuth", () => {
  let dir: string;
  let store: GmailCredentialStore;
  let auth: GmailAuth;

  const config = () => ({
    clientId: "client-id",
    clientSecret: "client-secret",
    credentialsDir: dir,
    scopes: GMAIL_READ_SCOPES,
  });

  const complete = (state = "state-1", callbackState = state) =>
    auth.complete({
      callbackUrl: `${REDIRECT}?state=${callbackState}&code=code-1`,
      redirectUri: REDIRECT,
      state,
      codeVerifier: "verifier-1",
      email: "Neil@Example.test",
    });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "gmail-creds-"));
    store = new GmailCredentialStore(config());
    auth = new GmailAuth(config(), store);
  });

  it("asks Google for offline, consented, read-only access to the mailbox", () => {
    const stub = client({});
    vi.spyOn(auth, "oauthClient").mockReturnValue(stub as never);
    const url = new URL(
      auth.start({
        redirectUri: REDIRECT,
        state: "state-1",
        codeChallenge: "challenge-1",
        email: EMAIL,
      }),
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      access_type: "offline",
      prompt: "consent",
      scope: "openid email https://www.googleapis.com/auth/gmail.readonly",
      state: "state-1",
      code_challenge: "challenge-1",
      code_challenge_method: "S256",
      login_hint: EMAIL,
    });
    expect(auth.oauthClient).toHaveBeenCalledWith(REDIRECT);
  });

  it("keeps the refresh token of the mailbox's own account", async () => {
    const stub = client({ sub: "g-1", email: EMAIL, email_verified: "true" });
    vi.spyOn(auth, "oauthClient").mockReturnValue(stub as never);

    const result = await complete();

    expect(result).toEqual({
      email: EMAIL,
      subject: "g-1",
      scope: GMAIL_READ_SCOPES.join(" "),
      created: true,
    });
    expect(stub.getToken).toHaveBeenCalledWith({
      code: "code-1",
      codeVerifier: "verifier-1",
      redirect_uri: REDIRECT,
    });
    expect(store.load(EMAIL)).toMatchObject({
      email: EMAIL,
      subject: "g-1",
      refreshToken: "refresh-1",
    });
    const file = fs.readdirSync(dir)[0];
    expect(fs.statSync(path.join(dir, file)).mode & 0o777).toBe(0o600);
  });

  it("replaces the token when the same account signs in again", async () => {
    vi.spyOn(auth, "oauthClient").mockReturnValue(
      client({ sub: "g-1", email: EMAIL, email_verified: true }) as never,
    );
    await complete();
    vi.spyOn(auth, "oauthClient").mockReturnValue(
      client(
        { sub: "g-1", email: EMAIL, email_verified: true },
        "refresh-2",
      ) as never,
    );
    const again = await complete();
    expect(again.created).toBe(false);
    expect(store.load(EMAIL)?.refreshToken).toBe("refresh-2");
  });

  it("refuses another mailbox, and keeps nothing", async () => {
    vi.spyOn(auth, "oauthClient").mockReturnValue(
      client({
        sub: "g-2",
        email: "other@example.test",
        email_verified: true,
      }) as never,
    );
    await expect(complete()).rejects.toEqual(
      new GmailAccountMismatchError("email"),
    );
    expect(store.list()).toEqual([]);
  });

  it("refuses an address Google has not verified", async () => {
    vi.spyOn(auth, "oauthClient").mockReturnValue(
      client({ sub: "g-1", email: EMAIL, email_verified: false }) as never,
    );
    await expect(complete()).rejects.toBeInstanceOf(GmailAccountMismatchError);
  });

  it("refuses the same address with another subject, keeping the stored token", async () => {
    vi.spyOn(auth, "oauthClient").mockReturnValue(
      client({ sub: "g-1", email: EMAIL, email_verified: true }) as never,
    );
    await complete();
    vi.spyOn(auth, "oauthClient").mockReturnValue(
      client(
        { sub: "g-9", email: EMAIL, email_verified: true },
        "refresh-x",
      ) as never,
    );
    await expect(complete()).rejects.toEqual(
      new GmailAccountMismatchError("subject"),
    );
    expect(store.load(EMAIL)?.refreshToken).toBe("refresh-1");
  });

  it("refuses a callback whose state is not the sign-in's", async () => {
    const stub = client({ sub: "g-1", email: EMAIL, email_verified: true });
    vi.spyOn(auth, "oauthClient").mockReturnValue(stub as never);
    await expect(complete("state-1", "state-2")).rejects.toThrow(/state/);
    expect(stub.getToken).not.toHaveBeenCalled();
  });

  it("refuses when Google sends no refresh token", async () => {
    vi.spyOn(auth, "oauthClient").mockReturnValue(
      client({ sub: "g-1", email: EMAIL, email_verified: true }, "") as never,
    );
    await expect(complete()).rejects.toThrow(/refresh token/);
  });

  it("answers 503 without a client", () => {
    const bare = new GmailAuth({ credentialsDir: dir } as never, store);
    expect(() => bare.oauthClient(REDIRECT)).toThrow(/not configured/);
  });
});
