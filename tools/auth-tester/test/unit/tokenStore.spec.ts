import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  afterIssue,
  expired,
  type SavedTokens,
  TokenStore,
} from "../../src/tokenStore";

const ISSUED = {
  accessToken: "access-2",
  expiresIn: 600,
  refreshToken: "refresh-2",
};

const SAVED: SavedTokens = {
  apiBaseUrl: "http://localhost:3001/v1",
  clientId: "olympus-auth-tester",
  provider: "google",
  accessToken: "access-1",
  accessTokenExpiresAt: 1_000_000,
  refreshToken: "refresh-1",
  sessionId: "session-1",
  savedAt: "2026-09-27T00:00:00.000Z",
};

describe("TokenStore", () => {
  let directory: string;
  let store: TokenStore;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "auth-tester-"));
    store = new TokenStore(path.join(directory, "nested", "tokens.json"));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("has nothing before anything is saved", () => {
    expect(store.read()).toBeUndefined();
    expect(() => store.require()).toThrow(/not signed in/);
  });

  it("round-trips the tokens, creating the directory", () => {
    store.save(SAVED);
    expect(store.read()).toEqual(SAVED);
  });

  /** A refresh token lives for weeks on a machine with other accounts on it. */
  it("keeps the file readable only by its owner", () => {
    store.save(SAVED);
    expect(fs.statSync(store.location).mode & 0o777).toBe(0o600);
  });

  it("tightens a file that was left readable", () => {
    store.save(SAVED);
    fs.chmodSync(store.location, 0o644);
    store.save(SAVED);
    expect(fs.statSync(store.location).mode & 0o777).toBe(0o600);
  });

  it("says which file to delete when it cannot be read", () => {
    fs.mkdirSync(path.dirname(store.location), { recursive: true });
    fs.writeFileSync(store.location, "half a file");
    expect(() => store.read()).toThrow(store.location);
  });

  it("clears, and clearing again is not an error", () => {
    store.save(SAVED);
    store.clear();
    store.clear();
    expect(store.read()).toBeUndefined();
  });
});

describe("afterIssue", () => {
  it("keeps the token it replaced, which is what a replay presents", () => {
    const next = afterIssue(SAVED, ISSUED, 2_000_000);
    expect(next.refreshToken).toBe("refresh-2");
    expect(next.previousRefreshToken).toBe("refresh-1");
    // The same session across a rotation: rotating does not start one.
    expect(next.sessionId).toBe("session-1");
    expect(next.accessTokenExpiresAt).toBe(2_000_000 + 600_000);
  });

  it("has no previous token the first time, at sign-in", () => {
    const first = afterIssue(
      {
        apiBaseUrl: SAVED.apiBaseUrl,
        clientId: SAVED.clientId,
        provider: SAVED.provider,
      },
      ISSUED,
      2_000_000,
    );
    expect(first.previousRefreshToken).toBeUndefined();
  });
});

describe("expired", () => {
  const at = (accessTokenExpiresAt: number): SavedTokens => ({
    ...SAVED,
    accessTokenExpiresAt,
  });

  it("counts a token with seconds left as spent", () => {
    // The margin is the call itself: a token that expires while the request
    // is in flight is refused as surely as one that expired a minute ago.
    expect(expired(at(1_000_000), 1_000_000 - 29_000)).toBe(true);
    expect(expired(at(1_000_000), 1_000_000 - 31_000)).toBe(false);
  });
});
