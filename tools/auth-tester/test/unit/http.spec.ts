import { describe, expect, it } from "vitest";
import { requestedUrl, transportFailure } from "../../src/http";

const failing = (code: string) => ({
  code,
  config: { baseURL: "https://localhost:3443/v1", url: "/olympus/ping" },
});

describe("transportFailure", () => {
  /**
   * The one worth a paragraph: a refused client certificate and a port held by
   * something else are the same closed socket, and neither says anything here.
   */
  it("explains a socket closed with no answer", () => {
    const message = transportFailure(failing("ECONNRESET"), "https://a/v1")!;
    expect(message).toContain("refused certificate");
    expect(message).toContain("lsof");
    expect(message).toContain("ECONNRESET");
  });

  it("names the plainer failures plainly", () => {
    expect(transportFailure(failing("ECONNREFUSED"), "https://a/v1")).toBe(
      "nothing is listening at https://a/v1",
    );
    expect(transportFailure(failing("ETIMEDOUT"), "https://a/v1")).toBe(
      "https://a/v1 did not answer",
    );
  });

  it("points a verification failure at --ca", () => {
    expect(
      transportFailure(failing("UNABLE_TO_VERIFY_LEAF_SIGNATURE"), "https://a"),
    ).toContain("--ca");
  });

  /** Anything it does not recognise is re-thrown whole, not paraphrased. */
  it("says nothing about what it does not know", () => {
    expect(
      transportFailure(failing("ESOMETHINGNEW"), "https://a"),
    ).toBeUndefined();
    expect(
      transportFailure(new Error("no code at all"), "https://a"),
    ).toBeUndefined();
  });
});

describe("requestedUrl", () => {
  it("joins the base URL axios recorded to the path", () => {
    expect(requestedUrl(failing("ECONNRESET"), "/ignored")).toBe(
      "https://localhost:3443/v1/olympus/ping",
    );
  });

  it("falls back to the path when there is no config", () => {
    expect(requestedUrl(new Error("bare"), "/olympus/ping")).toBe(
      "/olympus/ping",
    );
  });
});
