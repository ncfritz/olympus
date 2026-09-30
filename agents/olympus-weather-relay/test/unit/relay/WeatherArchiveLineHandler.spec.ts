import { Nack } from "@golevelup/nestjs-rabbitmq";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WeatherArchiveLineHandler } from "../../../src/relay/handlers/WeatherArchiveLineHandler";

const MESSAGE = {
  macAddress: "A0:B1:C2:D3:E4:F5",
  line: {
    receivedAt: "2026-09-29T20:00:03.000Z",
    source: "push" as const,
    remote: "192.168.15.20",
    query: "&PASSKEY=A0:B1:C2:D3:E4:F5&tempf=58.1",
  },
};

const ANSWER = {
  stored: 1,
  duplicate: 0,
  unknownStation: 0,
  invalid: 0,
  skipped: 0,
};

describe("WeatherArchiveLineHandler", () => {
  let importWeatherStationReadings: ReturnType<typeof vi.fn>;
  let handler: WeatherArchiveLineHandler;
  let waits: number[];

  beforeEach(() => {
    importWeatherStationReadings = vi.fn().mockResolvedValue(ANSWER);
    handler = new WeatherArchiveLineHandler({
      importWeatherStationReadings,
    } as never);
    waits = [];
    vi.spyOn(
      handler as unknown as { wait: (ms: number) => Promise<void> },
      "wait",
    ).mockImplementation(async (ms: number) => {
      waits.push(ms);
    });
  });

  it("imports the line as a record and acknowledges it", async () => {
    await expect(handler.handle(MESSAGE)).resolves.toBeUndefined();
    expect(importWeatherStationReadings).toHaveBeenCalledWith([
      {
        macAddress: "A0:B1:C2:D3:E4:F5",
        receivedAt: "2026-09-29T20:00:03.000Z",
        source: "push",
        remote: "192.168.15.20",
        query: "&PASSKEY=A0:B1:C2:D3:E4:F5&tempf=58.1",
      },
    ]);
  });

  it("acknowledges a line the API could not use: retrying will not help", async () => {
    importWeatherStationReadings.mockResolvedValue({
      ...ANSWER,
      stored: 0,
      unknownStation: 1,
    });
    await expect(handler.handle(MESSAGE)).resolves.toBeUndefined();
  });

  it("drops a message that is not an archive line, without calling the API", async () => {
    await expect(
      handler.handle({ macAddress: "x" } as never),
    ).resolves.toBeUndefined();
    await expect(handler.handle(undefined as never)).resolves.toBeUndefined();
    expect(importWeatherStationReadings).not.toHaveBeenCalled();
  });

  it("puts a line back after a wait when the API does not answer, waiting longer each time", async () => {
    importWeatherStationReadings.mockRejectedValue(new Error("ECONNREFUSED"));

    for (let i = 0; i < 6; i += 1) {
      const result = await handler.handle(MESSAGE);
      expect(result).toBeInstanceOf(Nack);
      expect((result as unknown as { requeue: boolean }).requeue).toBe(true);
    }
    expect(waits).toEqual([5_000, 10_000, 20_000, 40_000, 60_000, 60_000]);
  });

  it("starts the waits over once the API answers again", async () => {
    importWeatherStationReadings
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(ANSWER)
      .mockRejectedValueOnce(new Error("down"));
    await handler.handle(MESSAGE);
    await handler.handle(MESSAGE);
    await handler.handle(MESSAGE);
    await handler.handle(MESSAGE);
    expect(waits).toEqual([5_000, 10_000, 5_000]);
  });
});
