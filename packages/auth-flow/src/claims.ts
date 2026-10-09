import { decodeBase64Url } from "./base64url";
import { AuthFlowError } from "./errors";

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
    throw new AuthFlowError(
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
    parsed = JSON.parse(decodeBase64Url(part));
  } catch {
    throw new AuthFlowError(`the token's ${what} is not JSON`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AuthFlowError(`the token's ${what} is not an object`);
  }
  return parsed as Record<string, unknown>;
};
