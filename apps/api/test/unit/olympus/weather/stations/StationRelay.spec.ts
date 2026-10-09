import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherConfigType } from "../../../../../src/config/configuration";
import { StationRelay } from "../../../../../src/olympus/weather/stations/StationRelay";

const LINE = {
  receivedAt: "2026-09-29T20:00:03.000Z",
  source: "push" as const,
  remote: "10.15.1.20",
  query: "&PASSKEY=A0:B1:C2:D3:E4:F5",
};

describe("StationRelay", () => {
  let publish: ReturnType<typeof vi.fn>;

  const relay = (relayPublish: boolean) =>
    new StationRelay(
      { publish } as never,
      { stations: { relayPublish } } as WeatherConfigType,
    );

  beforeEach(() => {
    publish = vi.fn().mockResolvedValue(true);
  });

  it("publishes nothing where it is off", () => {
    relay(false).publish("A0:B1:C2:D3:E4:F5", LINE);
    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes the line, persistent, to the weather exchange", () => {
    relay(true).publish("A0:B1:C2:D3:E4:F5", LINE);
    expect(publish).toHaveBeenCalledWith(
      "weather.station.reports",
      "weather.archive.line",
      { macAddress: "A0:B1:C2:D3:E4:F5", line: LINE },
      { persistent: true },
    );
  });

  it("returns before the broker answers, and swallows its failure", async () => {
    let fail: (error: Error) => void = () => undefined;
    publish.mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    expect(() => relay(true).publish("A0:B1:C2:D3:E4:F5", LINE)).not.toThrow();
    fail(new Error("broker away"));
    // Let the rejection be handled; an unhandled one would fail the run.
    await new Promise((resolve) => setImmediate(resolve));
  });
});
