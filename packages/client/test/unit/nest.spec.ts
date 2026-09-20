import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { MetadataApi, NotificationApi } from "../../src";
import { OLYMPUS_CLIENTS, OlympusClientModule } from "../../src/nest";

describe("OlympusClientModule", () => {
  it("provides the clients and every wrapper", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        OlympusClientModule.forRootAsync({
          useFactory: () => ({
            baseUrl: "http://olympus-api:3100/v1",
            clientName: "test-agent",
          }),
        }),
      ],
    }).compile();

    expect(moduleRef.get(MetadataApi)).toBeInstanceOf(MetadataApi);
    expect(moduleRef.get(NotificationApi)).toBeInstanceOf(NotificationApi);
    const clients = moduleRef.get(OLYMPUS_CLIENTS);
    expect(clients.dionysus.getConfig().baseURL).toBe(
      "http://olympus-api:3100/v1",
    );
  });
});
