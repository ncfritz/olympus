import { TesterError } from "./errors";

export type DecodedToken = {
  /** `alg` and `kid`: which key signed it, by RFC 7638 thumbprint. */
  header: Record<string, unknown>;
  claims: Record<string, unknown>;
};

/**
 * The header and claims of an access token, decoded and **not verified**.
 *
 * Deliberately not verified. Whether the signature is good is the API's
 * answer to give, and the tester asking the same question with the same
 * JWKS would only prove that two copies of the same code agree. What proves
 * the token is good is the API accepting it, which is what `whoami` does
 * next.
 */
export const decodeToken = (token: string): DecodedToken => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new TesterError(
      "that does not look like a JWT: expected three parts",
    );
  }
  return {
    header: segment(parts[0]!, "header"),
    claims: segment(parts[1]!, "claims"),
  };
};

const segment = (part: string, what: string): Record<string, unknown> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    throw new TesterError(`the token's ${what} is not JSON`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TesterError(`the token's ${what} is not an object`);
  }
  return parsed as Record<string, unknown>;
};

/** The claims as lines, for printing: the ones that mean something first. */
export const describeToken = (token: DecodedToken): string[] => {
  const known = [
    "sub",
    "sid",
    "client_id",
    "roles",
    "aud",
    "iss",
    "iat",
    "auth_time",
    "exp",
  ];
  const lines = [
    `  alg     ${string_(token.header.alg)}`,
    `  kid     ${string_(token.header.kid)}`,
  ];
  for (const name of known) {
    if (name in token.claims) {
      lines.push(`  ${name.padEnd(7)} ${claim(name, token.claims[name])}`);
    }
  }
  for (const [name, value] of Object.entries(token.claims)) {
    if (!known.includes(name)) {
      lines.push(`  ${name.padEnd(7)} ${string_(value)}`);
    }
  }
  return lines;
};

/** Seconds since the epoch read as a time; anything else as it is. */
const claim = (name: string, value: unknown): string => {
  const times = ["iat", "exp", "auth_time"];
  if (times.includes(name) && typeof value === "number") {
    return `${value}  (${new Date(value * 1000).toISOString()})`;
  }
  return string_(value);
};

const string_ = (value: unknown): string =>
  Array.isArray(value) ? value.join(", ") : String(value);
