import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { Test, TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { WorkflowApi } from "../../src/api/WorkflowApi";
import { AppModule } from "../../src/AppModule";
import { CertificationsBatchHandler } from "../../src/batch/handlers/CertificationsBatchHandler";
import { CollectionsBatchHandler } from "../../src/batch/handlers/CollectionsBatchHandler";
import { CountriesBatchHandler } from "../../src/batch/handlers/CountriesBatchHandler";
import { GenresBatchHandler } from "../../src/batch/handlers/GenresBatchHandler";
import { KeywordsBatchHandler } from "../../src/batch/handlers/KeywordsBatchHandler";
import { LanguagesBatchHandler } from "../../src/batch/handlers/LanguagesBatchHandler";
import { MovieBatchHandler } from "../../src/batch/handlers/MovieBatchHandler";
import { PeopleBatchHandler } from "../../src/batch/handlers/PeopleBatchHandler";
import { ProductionCompaniesBatchHandler } from "../../src/batch/handlers/ProductionCompaniesBatchHandler";
import { RedriveBatchHandler } from "../../src/batch/handlers/RedriveBatchHandler";
import { TvNetworksBatchHandler } from "../../src/batch/handlers/TvNetworksBatchHandler";
import { TvSeriesBatchHandler } from "../../src/batch/handlers/TvSeriesBatchHandler";
import { CollectionMetadataHandler } from "../../src/entities/handlers/CollectionMetadataHandler";
import { MovieMetadataHandler } from "../../src/entities/handlers/MovieMetadataHandler";
import { PersonMetadataHandler } from "../../src/entities/handlers/PersonMetadataHandler";
import { ProductionCompanyMetadataHandler } from "../../src/entities/handlers/ProductionCompanyMetadataHandler";
import { TvEpisodeMetadataHandler } from "../../src/entities/handlers/TvEpisodeMetadataHandler";
import { TvNetworkMetadataHandler } from "../../src/entities/handlers/TvNetworkMetadataHandler";
import { TvSeasonMetadataHandler } from "../../src/entities/handlers/TvSeasonMetadataHandler";
import { TvSeriesMetadataHandler } from "../../src/entities/handlers/TvSeriesMetadataHandler";
import {
  BATCH_SUBSCRIPTIONS,
  ENTITY_SUBSCRIPTIONS,
  JOB_COMPLETION_SUBSCRIPTION,
  REDRIVE_SUBSCRIPTION,
  START_WORKFLOW_SUBSCRIPTION,
} from "../../src/messaging";
import { StartWorkflowHandler } from "../../src/workflow/handlers/StartWorkflowHandler";
import { WorkflowJobCompletionHandler } from "../../src/workflow/handlers/WorkflowJobCompletionHandler";
import { ExecutionRegistry } from "../../src/workflow/services/ExecutionRegistry";
import { JobNotifier } from "../../src/workflow/services/JobNotifier";

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

  it("fails what is still running when the app shuts down", async () => {
    const workflowApi = {
      updateWorkflow: vi.fn(async (id: string) => ({ id })),
    };
    const app = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(WorkflowApi)
      .useValue(workflowApi)
      .overrideProvider(JobNotifier)
      .useValue({ sendWorkflowNotification: vi.fn() })
      .compile();
    app.get(ExecutionRegistry).add({ id: "wf-1", type: "workflow" });

    await app.close();

    expect(workflowApi.updateWorkflow).toHaveBeenCalledWith("wf-1", {
      status: "failed",
    });
  });

  it.each([
    [CertificationsBatchHandler, BATCH_SUBSCRIPTIONS.certifications],
    [CollectionsBatchHandler, BATCH_SUBSCRIPTIONS.collections],
    [CountriesBatchHandler, BATCH_SUBSCRIPTIONS.countries],
    [GenresBatchHandler, BATCH_SUBSCRIPTIONS.genres],
    [KeywordsBatchHandler, BATCH_SUBSCRIPTIONS.keywords],
    [LanguagesBatchHandler, BATCH_SUBSCRIPTIONS.languages],
    [MovieBatchHandler, BATCH_SUBSCRIPTIONS.movies],
    [PeopleBatchHandler, BATCH_SUBSCRIPTIONS.people],
    [ProductionCompaniesBatchHandler, BATCH_SUBSCRIPTIONS.production_companies],
    [TvNetworksBatchHandler, BATCH_SUBSCRIPTIONS.tv_networks],
    [TvSeriesBatchHandler, BATCH_SUBSCRIPTIONS.tv_series],
    [RedriveBatchHandler, REDRIVE_SUBSCRIPTION],
    [CollectionMetadataHandler, ENTITY_SUBSCRIPTIONS.collections],
    [MovieMetadataHandler, ENTITY_SUBSCRIPTIONS.movies],
    [PersonMetadataHandler, ENTITY_SUBSCRIPTIONS.people],
    [
      ProductionCompanyMetadataHandler,
      ENTITY_SUBSCRIPTIONS.production_companies,
    ],
    [TvNetworkMetadataHandler, ENTITY_SUBSCRIPTIONS.tv_networks],
    [TvSeriesMetadataHandler, ENTITY_SUBSCRIPTIONS.tv_series],
    [TvSeasonMetadataHandler, ENTITY_SUBSCRIPTIONS.tv_seasons],
    [TvEpisodeMetadataHandler, ENTITY_SUBSCRIPTIONS.tv_episodes],
    [StartWorkflowHandler, START_WORKFLOW_SUBSCRIPTION],
    [WorkflowJobCompletionHandler, JOB_COMPLETION_SUBSCRIPTION],
  ])("wires %o to its queue", (handler, expected) => {
    expect(moduleRef.get(handler)).toBeInstanceOf(handler);
    expect(subscription(handler)).toMatchObject(expected);
  });
});
