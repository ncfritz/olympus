import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { ProviderError } from "../../../../../src/olympus/weather/providers/ProviderError";

const KEY = "0123456789abcdef";

const axiosError = (status?: number, code?: string) => {
  const config = {
    url: `/weather?lat=1&lon=2&appid=${KEY}`,
    headers: new AxiosHeaders(),
  };
  return new AxiosError(
    "failed",
    code,
    config,
    {},
    status === undefined
      ? undefined
      : {
          status,
          statusText: "",
          headers: {},
          config,
          data: { message: `Invalid API key ${KEY}` },
        },
  );
};

describe("ProviderError", () => {
  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [429, "rate_limited"],
    [404, "not_found"],
    [502, "unavailable"],
  ])("reads HTTP %i as %s", (status, reason) => {
    expect(ProviderError.from("openweather", axiosError(status)).reason).toBe(
      reason,
    );
  });

  it("reads a timeout", () => {
    expect(
      ProviderError.from("openweather", axiosError(undefined, "ECONNABORTED"))
        .reason,
    ).toBe("timeout");
  });

  it("never carries the key: not in its message, not anywhere in it", () => {
    const error = ProviderError.from("openweather", axiosError(401));
    expect(error.message).toBe("openweather: unauthorized (HTTP 401)");
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain(
      KEY,
    );
    expect(error.stack ?? "").not.toContain(KEY);
  });

  it("reads anything else as unavailable", () => {
    expect(ProviderError.from("openweather", new Error("boom")).reason).toBe(
      "unavailable",
    );
  });
});
