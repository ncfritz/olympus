import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { Test, TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../../src/AppModule";
import { SearchConfigurationFanoutHandler } from "../../src/fanout/handlers/SearchConfigurationFanoutHandler";
import { SEARCH_SUBSCRIPTIONS, FANOUT_SUBSCRIPTION } from "../../src/messaging";
import { MovieSearchHandler } from "../../src/search/handlers/MovieSearchHandler";
import { TvEpisodeSearchHandler } from "../../src/search/handlers/TvEpisodeSearchHandler";
import { TvSeasonSearchHandler } from "../../src/search/handlers/TvSeasonSearchHandler";
import { TvSeriesSearchHandler } from "../../src/search/handlers/TvSeriesSearchHandler";

/** The @RabbitSubscribe configuration of a handler's handle(). */
const subscription = (handler: { prototype: object }) => {
  const handle = (handler.prototype as { handle: object }).handle;
  return Reflect.getMetadataKeys(handle)
    .map((key) => Reflect.getMetadata(key, handle))
    .find((value) => value && typeof value === "object" && "queue" in value);
};

// Never connect to a broker.
AmqpConnection.prototype.init = async () => {};
AmqpConnection.prototype.close = async () => {};

/**
 * Resolves the whole dependency graph (compile() does not start the app)
 * and checks each handler's queue.
 */
describe("AppModule", () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  afterAll(async () => moduleRef.close());

  it.each([
    [MovieSearchHandler, SEARCH_SUBSCRIPTIONS.movie],
    [TvSeriesSearchHandler, SEARCH_SUBSCRIPTIONS.tv_series],
    [TvSeasonSearchHandler, SEARCH_SUBSCRIPTIONS.tv_season],
    [TvEpisodeSearchHandler, SEARCH_SUBSCRIPTIONS.tv_episode],
    [SearchConfigurationFanoutHandler, FANOUT_SUBSCRIPTION],
  ])("wires %o to its queue", (handler, expected) => {
    expect(moduleRef.get(handler)).toBeInstanceOf(handler);
    expect(subscription(handler)).toMatchObject(expected);
  });
});
