import { describe, expect, it, vi } from "vitest";
import * as messages from "../../src";

/** Publishers and consumers bind to these names: renames are deliberate. */
describe("message routes", () => {
  const routes = {
    notifications: Object.values(messages.NotificationChannel).map(
      messages.notificationRoute,
    ),
    calendarEvents: messages.CALENDAR_EVENT_ACTIONS.map(
      messages.calendarEventRoute,
    ),
    batchJobs: [
      ...messages.METADATA_JOB_TYPES.map(messages.batchJobRoute),
      messages.REDRIVE_JOB_ROUTE,
      messages.START_WORKFLOW_ROUTE,
      messages.BATCH_JOB_COMPLETION_ROUTE,
    ],
    metadataJobs: messages.METADATA_JOB_TYPES.map(messages.metadataJobRoute),
    content: [
      messages.RAW_INGEST_ROUTE,
      ...messages.CONTENT_JOB_TYPES.map(messages.contentJobRoute),
    ],
    media: Object.values(messages.MEDIA_ROUTES),
    downloads: [messages.START_DOWNLOAD_ROUTE, messages.DOWNLOAD_UPDATE_ROUTE],
    search: [
      ...messages.MEDIA_ASSET_TYPES.map(messages.searchExecutionRoute),
      messages.SEARCH_FANOUT_ROUTE,
    ],
  };

  it("match the snapshot", () => {
    const summary = Object.fromEntries(
      Object.entries(routes).map(([family, list]) => [
        family,
        list.map(
          (r) => `${r.exchange.name} (${r.exchange.type}) ${r.routingKey}`,
        ),
      ]),
    );
    expect(summary).toMatchSnapshot();
  });

  it("declare delayed exchanges with their routing type", () => {
    expect(
      messages.declare(messages.SEARCH_EXECUTION_TRIGGER_EXCHANGE),
    ).toEqual([
      {
        name: "search.execution.trigger",
        type: "x-delayed-message",
        options: { arguments: { "x-delayed-type": "topic" } },
      },
    ]);
  });
});

describe("publishMessage", () => {
  it("publishes on the route, passing options only when given", async () => {
    const publish = vi.fn().mockResolvedValue(true);
    const route = messages.metadataJobRoute("movies");
    await messages.publishMessage({ publish }, route, {
      entityId: "e",
      entityType: "movies",
    });
    await messages.publishMessage(
      { publish },
      route,
      { entityId: "e", entityType: "movies" },
      messages.delayed(10000),
    );
    expect(publish.mock.calls).toEqual([
      [
        "metadataJob.trigger",
        "jobType.movies",
        { entityId: "e", entityType: "movies" },
      ],
      [
        "metadataJob.trigger",
        "jobType.movies",
        { entityId: "e", entityType: "movies" },
        { persistent: true, headers: { "x-delay": 10000 } },
      ],
    ]);
  });

  it("builds @RabbitSubscribe options", () => {
    expect(
      messages.subscription(
        messages.SEARCH_FANOUT_ROUTE,
        "search.fanout.trigger",
      ),
    ).toEqual({
      exchange: "search.fanout.trigger",
      routingKey: "",
      queue: "search.fanout.trigger",
    });
  });
});
