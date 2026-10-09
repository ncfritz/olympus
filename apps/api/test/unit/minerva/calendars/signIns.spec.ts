import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import {
  callbackUrlFor,
  decideLink,
  hashState,
  isClientPage,
  newSignInSecrets,
  withOutcome,
} from "../../../../src/minerva/calendars/utils/signIns";

const ME = "5f1a0c6e-0000-4000-8000-000000000001";
const SOMEONE = "5f1a0c6e-0000-4000-8000-0000000000ff";

describe("newSignInSecrets", () => {
  it("keeps the state only as its hash, and pairs the verifier with its S256 challenge", () => {
    const secrets = newSignInSecrets();

    expect(secrets.stateHash).toBe(hashState(secrets.state));
    expect(secrets.stateHash).not.toContain(secrets.state);
    expect(secrets.codeChallenge).toBe(
      createHash("sha256").update(secrets.codeVerifier).digest("base64url"),
    );
    // RFC 7636: a verifier of 43 to 128 unreserved characters.
    expect(secrets.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
  });

  it("is new every time", () => {
    const a = newSignInSecrets();
    const b = newSignInSecrets();
    expect(a.state).not.toBe(b.state);
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });
});

describe("callbackUrlFor", () => {
  it.each([
    ["https://olympus.example.com", "google"],
    ["https://olympus.example.com/", "google"],
  ])("puts the callback under %s", (base, provider) => {
    expect(callbackUrlFor(base, provider)).toBe(
      "https://olympus.example.com/v1/minerva/calendar-accounts/callback/google",
    );
  });

  it("keeps the path the API is published under", () => {
    expect(callbackUrlFor("https://example.com/api/", "microsoft")).toBe(
      "https://example.com/api/v1/minerva/calendar-accounts/callback/microsoft",
    );
  });
});

describe("isClientPage", () => {
  const origins = ["https://olympus.example.com", "http://localhost:3000"];

  it.each([
    "https://olympus.example.com/minerva/calendars",
    "http://localhost:3000/minerva/calendars?tab=accounts",
  ])("accepts %s", (page) => {
    expect(isClientPage(page, origins)).toBe(true);
  });

  it.each([
    ["another origin", "https://evil.example.com/minerva"],
    ["a look-alike host", "https://olympus.example.com.evil.example/"],
    ["another port", "http://localhost:3001/"],
    ["another scheme", "http://olympus.example.com/"],
    ["a relative path", "/minerva/calendars"],
    ["a protocol-relative URL", "//evil.example.com/"],
    ["not a string", 42],
    ["nothing", undefined],
  ])("refuses %s", (_, page) => {
    expect(isClientPage(page, origins)).toBe(false);
  });

  it("refuses everything when there are no client origins", () => {
    expect(isClientPage("https://olympus.example.com/", [])).toBe(false);
  });
});

describe("withOutcome", () => {
  it("adds the outcome to the page's query, keeping what it had", () => {
    expect(
      withOutcome("https://olympus.example.com/calendars?tab=accounts", {
        calendarAccount: "connected",
        accountId: "abc",
      }),
    ).toBe(
      "https://olympus.example.com/calendars?tab=accounts&calendarAccount=connected&accountId=abc",
    );
  });

  it("replaces an outcome the page already carried", () => {
    expect(
      withOutcome("https://olympus.example.com/calendars?calendarAccount=x", {
        calendarAccount: "failed",
      }),
    ).toBe("https://olympus.example.com/calendars?calendarAccount=failed");
  });
});

describe("decideLink", () => {
  it("links an account no one owns", () => {
    expect(decideLink({ userId: ME })).toEqual({
      link: true,
      alreadyTheirs: false,
    });
  });

  it("links the user's own account again, as already theirs", () => {
    expect(decideLink({ userId: ME, ownerId: ME })).toEqual({
      link: true,
      alreadyTheirs: true,
    });
  });

  it("links the account the user signs in to Olympus with", () => {
    expect(decideLink({ userId: ME, identityOwnerId: ME })).toEqual({
      link: true,
      alreadyTheirs: false,
    });
  });

  it("refuses another user's account", () => {
    expect(decideLink({ userId: ME, ownerId: SOMEONE })).toMatchObject({
      link: false,
    });
  });

  it("refuses an unowned account another user signs in to Olympus with", () => {
    expect(decideLink({ userId: ME, identityOwnerId: SOMEONE })).toEqual({
      link: false,
      reason: "the account is another user's sign-in identity",
    });
  });
});
