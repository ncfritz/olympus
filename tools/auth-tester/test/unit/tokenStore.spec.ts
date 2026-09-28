import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SavedTokens } from "@ncfritz/olympus-auth-flow";
import { TokenStore } from "../../src/tokenStore";

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
