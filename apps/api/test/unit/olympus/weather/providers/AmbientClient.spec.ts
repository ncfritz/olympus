import { AxiosError, AxiosHeaders } from "axios";
import moment from "moment";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherConfigType } from "../../../../../src/config/configuration";
import {
  AMBIENT_REQUEST_GAP_MS,
  AmbientClient,
} from "../../../../../src/olympus/weather/providers/AmbientClient";
import { ProviderError } from "../../../../../src/olympus/weather/providers/ProviderError";

const KEYS = { applicationKey: "app-secret-1", apiKey: "api-secret-2" };
const MAC = "A0:B1:C2:D3:E4:F5";

const config = (ambient = KEYS) =>
  ({ providerTimeoutMs: 5000, ambient }) as unknown as WeatherConfigType;

const axiosError = (status: number) =>
  new AxiosError(
    "Request failed",
    "ERR_BAD_RESPONSE",
    {
      url: `https://rt.ambientweather.net/v1/devices/x?apiKey=${KEYS.apiKey}`,
      headers: new AxiosHeaders(),
    },
    {},
    {
      status,
      statusText: "",
      data: {},
      headers: {},
      config: { headers: new AxiosHeaders() },
    },
  );

describe("AmbientClient", () => {
  let get: ReturnType<typeof vi.fn>;
  let client: AmbientClient;
  let pauses: number[];

  const make = (settings = config()) => {
    const made = new AmbientClient(settings);
    (made as unknown as { http: { get: typeof get } }).http = { get };
    pauses = [];
    vi.spyOn(
      made as unknown as { pause: (ms: number) => Promise<void> },
      "pause",
    ).mockImplementation(async (ms: number) => {
      pauses.push(ms);
      vi.advanceTimersByTime(ms);
    });
    return made;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T20:00:00Z"));
    get = vi.fn().mockResolvedValue({ status: 200, data: [{ dateutc: 1 }] });
    client = make();
  });

  afterEach(() => vi.useRealTimers());

  it("asks for up to 288 records ending at the date, with both keys", async () => {
    const records = await client.deviceData(
      MAC,
      moment.utc("2026-09-29T12:00:00Z"),
    );
    expect(records).toEqual([{ dateutc: 1 }]);
    expect(get).toHaveBeenCalledWith("/devices/A0%3AB1%3AC2%3AD3%3AE4%3AF5", {
      params: {
        applicationKey: "app-secret-1",
        apiKey: "api-secret-2",
        endDate: Date.parse("2026-09-29T12:00:00Z"),
        limit: 288,
      },
    });
  });

  it("spaces requests at least 1.1 seconds apart, one at a time", async () => {
    await Promise.all([
      client.deviceData(MAC, moment.utc()),
      client.deviceData(MAC, moment.utc()),
      client.deviceData(MAC, moment.utc()),
    ]);
    expect(get).toHaveBeenCalledTimes(3);
    expect(pauses).toEqual([AMBIENT_REQUEST_GAP_MS, AMBIENT_REQUEST_GAP_MS]);
  });

  it("keeps going after a failed request", async () => {
    get.mockRejectedValueOnce(axiosError(500));
    await expect(client.deviceData(MAC, moment.utc())).rejects.toThrow(
      ProviderError,
    );
    await expect(client.deviceData(MAC, moment.utc())).resolves.toEqual([
      { dateutc: 1 },
    ]);
  });

  it.each([
    [401, "unauthorized"],
    [429, "rate_limited"],
    [500, "unavailable"],
  ])("turns a %i into %s, without the keys", async (status, reason) => {
    get.mockRejectedValue(axiosError(status));
    const error = await client
      .deviceData(MAC, moment.utc())
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).reason).toBe(reason);
    expect(String(error)).not.toContain("secret");
    expect(JSON.stringify(error)).not.toContain("secret");
  });

  it("refuses a body that is not a list", async () => {
    get.mockResolvedValue({ status: 200, data: { error: "no" } });
    await expect(client.deviceData(MAC, moment.utc())).rejects.toMatchObject({
      reason: "unavailable",
    });
  });

  it("is not configured without the keys, and asks nothing", async () => {
    client = make({ providerTimeoutMs: 5000 } as WeatherConfigType);
    expect(client.configured).toBe(false);
    await expect(client.deviceData(MAC, moment.utc())).rejects.toMatchObject({
      reason: "not_configured",
    });
    expect(get).not.toHaveBeenCalled();
  });
});
