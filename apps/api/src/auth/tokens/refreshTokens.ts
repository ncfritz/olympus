import { createHash, randomBytes, timingSafeEqual } from "crypto";

/** Thirty days (ADR 0018). */
export const REFRESH_TOKEN_DAYS = 30;

/**
 * Refresh tokens are opaque and stored only as a hash (ADR 0018), so a copy
 * of the sessions table is not a set of working credentials.
 *
 * SHA-256 with no salt and no work factor, deliberately: this is a 256-bit
 * random value, not a password. There is nothing to guess, so stretching
 * would only make every refresh slower, and a per-row salt would stop the
 * hash being what we look the session up by.
 */
export const hashRefreshToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("base64url");

export type NewRefreshToken = {
  /** Given to the client, once, and never stored. */
  token: string;
  /** What goes in the sessions row. */
  hash: string;
  expiresAt: Date;
};

export const newRefreshToken = (now: Date = new Date()): NewRefreshToken => {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: hashRefreshToken(token),
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_DAYS * 86_400_000),
  };
};

/**
 * Compares two hashes in constant time. Neither is a secret — they are
 * derived from one — but a comparison that leaks where they first differ is
 * a bad habit to keep on a credential path.
 */
export const hashesMatch = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
