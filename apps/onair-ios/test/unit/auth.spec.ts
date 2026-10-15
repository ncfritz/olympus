import { AuthFlowError } from "@ncfritz/olympus-auth-flow";
import { describe, expect, it } from "vitest";

import { classifyFailure } from "../../src/auth/failure";
import { slug, tokensKey } from "../../src/auth/keys";

describe("tokensKey", () => {
  it("is a SecureStore key, readable, one per API", () => {
    expect(tokensKey("https://olympus.internal.ncfritz.net/api/v1")).toBe(
      "tokens.https-olympus.internal.ncfritz.net-api-v1",
    );
    expect(slug("a:/b")).toMatch(/^[A-Za-z0-9.\-_]+$/);
  });
});

describe("classifyFailure", () => {
  it("ends the session when a refresh is refused", () => {
    expect(
      classifyFailure(new AuthFlowError("the API refused: invalid_grant")).kind,
    ).toBe("signed-out");
  });

  it("ends the session on a 401", () => {
    expect(classifyFailure({ response: { status: 401 } }).kind).toBe(
      "signed-out",
    );
  });

  it("keeps the session through a rate limit, a 5xx or no answer", () => {
    expect(
      classifyFailure(
        new AuthFlowError("the API is rate limiting the token endpoint"),
      ).kind,
    ).toBe("unreachable");
    expect(classifyFailure({ response: { status: 502 } }).kind).toBe(
      "unreachable",
    );
    expect(classifyFailure(new TypeError("Network request failed")).kind).toBe(
      "unreachable",
    );
  });
});
