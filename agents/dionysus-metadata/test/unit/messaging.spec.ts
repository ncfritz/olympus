import { describe, expect, it } from "vitest";
import {
  BATCH_SUBSCRIPTIONS,
  CHANNELS,
  ENTITY_SUBSCRIPTIONS,
  JOB_COMPLETION_SUBSCRIPTION,
  REDRIVE_SUBSCRIPTION,
  START_WORKFLOW_SUBSCRIPTION,
} from "../../src/messaging";

/**
 * The queues predate the shared contract; renaming one strands its
 * messages, and the channels set how much runs at once.
 */
describe("subscriptions", () => {
  it("keeps the queue names, routing keys and channels", () => {
    expect({
      batch: BATCH_SUBSCRIPTIONS,
      redrive: REDRIVE_SUBSCRIPTION,
      entities: ENTITY_SUBSCRIPTIONS,
      startWorkflow: START_WORKFLOW_SUBSCRIPTION,
      jobCompletion: JOB_COMPLETION_SUBSCRIPTION,
      channels: CHANNELS,
    }).toMatchSnapshot();
  });

  it("names each queue after its exchange and job type", () => {
    for (const [type, options] of Object.entries(BATCH_SUBSCRIPTIONS)) {
      expect(options).toMatchObject({
        exchange: "batchJob.trigger",
        routingKey: `jobType.${type}`,
        queue: `batchJob.${type}.trigger`,
      });
    }
    for (const [type, options] of Object.entries(ENTITY_SUBSCRIPTIONS)) {
      expect(options).toMatchObject({
        exchange: "metadataJob.trigger",
        routingKey: `jobType.${type}`,
        queue: `metadataJob.${type}.trigger`,
      });
    }
  });
});
