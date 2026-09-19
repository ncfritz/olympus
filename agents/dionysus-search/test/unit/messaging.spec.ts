import { describe, expect, it } from "vitest";
import { FANOUT_SUBSCRIPTION, SEARCH_SUBSCRIPTIONS } from "../../src/messaging";

/** The queues predate the shared contract; renaming one strands its messages. */
describe("subscriptions", () => {
  it("keeps the queue names", () => {
    expect(SEARCH_SUBSCRIPTIONS).toEqual({
      movie: {
        exchange: "search.execution.trigger",
        routingKey: "jobType.movie",
        queue: "search.execution.movie.trigger",
      },
      tv_series: {
        exchange: "search.execution.trigger",
        routingKey: "jobType.tv_series",
        queue: "search.execution.tv_series.trigger",
      },
      tv_season: {
        exchange: "search.execution.trigger",
        routingKey: "jobType.tv_season",
        queue: "search.execution.tv_season.trigger",
      },
      tv_episode: {
        exchange: "search.execution.trigger",
        routingKey: "jobType.tv_episode",
        queue: "search.execution.tv_episode.trigger",
      },
    });
    expect(FANOUT_SUBSCRIPTION).toEqual({
      exchange: "search.fanout.trigger",
      routingKey: "",
      queue: "search.fanout.trigger",
    });
  });
});
