import { describe, expect, it } from "vitest";
import { fetchFailure } from "../../../src/utils/fetchFailure";

const refused = (address: string, port: number) =>
  Object.assign(new Error(`connect ECONNREFUSED ${address}:${port}`), {
    code: "ECONNREFUSED",
    address,
    port,
  });

describe("fetchFailure", () => {
  it("names each address a name resolved to, when all were refused", () => {
    const failed = new TypeError("fetch failed", {
      cause: new AggregateError(
        [refused("::1", 8480), refused("127.0.0.1", 8480)],
        "",
      ),
    });
    expect(fetchFailure(failed)).toBe(
      "ECONNREFUSED ::1:8480, ECONNREFUSED 127.0.0.1:8480",
    );
  });

  it("names a single cause by its code", () => {
    const failed = new TypeError("fetch failed", {
      cause: Object.assign(new Error("unable to verify"), {
        code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      }),
    });
    expect(fetchFailure(failed)).toBe("UNABLE_TO_VERIFY_LEAF_SIGNATURE");
  });

  it("falls back to the message, as for a timeout", () => {
    expect(
      fetchFailure(
        new DOMException("The operation timed out.", "TimeoutError"),
      ),
    ).toBe("The operation timed out.");
  });
});
