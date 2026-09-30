import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { Test, TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../../src/AppModule";
import { rabbitConfig } from "../../src/infra/RabbitModule";
import { WeatherArchiveLineHandler } from "../../src/relay/handlers/WeatherArchiveLineHandler";

/** The @RabbitSubscribe configuration of a handler's handle(). */
const subscription = (handler: { prototype: object }) => {
  const handle = (handler.prototype as { handle: object }).handle;
  return Reflect.getMetadataKeys(handle)
    .map((key) => Reflect.getMetadata(key, handle))
    .find((value) => value && typeof value === "object" && "name" in value);
};

// Never connect to a broker.
AmqpConnection.prototype.init = async () => {};
AmqpConnection.prototype.close = async () => {};

/**
 * Resolves the whole dependency graph (compile() does not start the app) and
 * checks the handler's binding.
 */
describe("AppModule", () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    process.env.AMQP_PASSWORD ??= "test";
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  afterAll(async () => moduleRef.close());

  it("provides the relay handler, bound by name", () => {
    expect(moduleRef.get(WeatherArchiveLineHandler)).toBeInstanceOf(
      WeatherArchiveLineHandler,
    );
    expect(subscription(WeatherArchiveLineHandler)).toMatchObject({
      name: "weatherRelay",
    });
  });

  it("binds that name to the database's queue on the weather exchange", () => {
    const config = rabbitConfig(
      { uri: "amqp://relay@localhost/%2Fdionysus-dev" } as never,
      { database: "olympus_dev" },
    );
    expect(config.handlers?.weatherRelay).toEqual({
      exchange: "weather.station.reports",
      routingKey: "weather.archive.line",
      queue: "weather.station.reports.olympus_dev",
      queueOptions: {
        durable: true,
        arguments: {
          "x-message-ttl": 172_800_000,
          "x-max-length": 30_000,
          "x-overflow": "drop-head",
          "x-expires": 604_800_000,
        },
      },
    });
    expect(config.exchanges).toEqual([
      { name: "weather.station.reports", type: "fanout", options: undefined },
    ]);
    expect(config.prefetchCount).toBe(1);
  });
});
