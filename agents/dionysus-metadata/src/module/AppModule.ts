import { Logger, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";
import { CertificationsBatchHandler } from "../handler/batch/CertificationsBatchHandler";
import { CollectionsBatchHandler } from "../handler/batch/CollectionsBatchHandler";
import { CountriesBatchHandler } from "../handler/batch/CountiresBatchHandler";
import { GenresBatchHandler } from "../handler/batch/GenresBatchHandler";
import { KeywordsBatchHandler } from "../handler/batch/KeywordsBatchHandler";
import { LanguagesBatchHandler } from "../handler/batch/LanguagesBatchHandler";
import { MovieBatchHandler } from "../handler/batch/MovieBatchHandler";
import { PeopleBatchHandler } from "../handler/batch/PeopleBatchHandler";
import { ProductionCompaniesBatchHandler } from "../handler/batch/ProductionCompaniesBatchHandler";
import { RedriveBatchHandler } from "../handler/batch/RedriveBatchHandler";
import { TVNetworksBatchHandler } from "../handler/batch/TVNetworksBatchHandler";
import { TVSeriesBatchHandler } from "../handler/batch/TVSeriesBatchHandler";
import { CollectionsMetadataHandler } from "../handler/metadata/CollectionMetadataHandler";
import { MoviesMetadataHandler } from "../handler/metadata/MovieMetadataHandler";
import { PersonMetadataHandler } from "../handler/metadata/PersonMetadataHandler";
import { ProductionCompanyMetadataHandler } from "../handler/metadata/ProductionCompantMetadataHandler";
import { TVEpisodeMetadataHandler } from "../handler/metadata/TVEpisodeMetadataHandler";
import { TVNetworkMetadataHandler } from "../handler/metadata/TVNetworkMetadataHandler";
import { TVSeasonMetadataHandler } from "../handler/metadata/TVSeasonMetadataHandler";
import { TVSeriesMetadataHandler } from "../handler/metadata/TVSeriesMetadataHandler";
import { StartWorkflowHandler } from "../handler/workflow/StartWorkflowHandler";
import { WorkflowJobCompletionHandler } from "../handler/workflow/WorkflowJobCompletionHandler";
import { RabbitModule } from "./RabbitModule";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `${process.env.NODE_ENV}.env`,
      isGlobal: true,
    }),
    PrometheusModule.register({
      defaultLabels: {
        app: "dionysus-metadata-agent",
      },
    }),
    RabbitModule,
  ],
  exports: [],
  providers: [
    // Logging
    Logger,
    // Batch Jobs
    CertificationsBatchHandler,
    CollectionsBatchHandler,
    CountriesBatchHandler,
    GenresBatchHandler,
    KeywordsBatchHandler,
    LanguagesBatchHandler,
    MovieBatchHandler,
    PeopleBatchHandler,
    ProductionCompaniesBatchHandler,
    TVNetworksBatchHandler,
    TVSeriesBatchHandler,

    // Metadata Jobs
    CollectionsMetadataHandler,
    MoviesMetadataHandler,
    PersonMetadataHandler,
    ProductionCompanyMetadataHandler,
    TVEpisodeMetadataHandler,
    TVNetworkMetadataHandler,
    TVSeasonMetadataHandler,
    TVSeriesMetadataHandler,

    // Redrive
    RedriveBatchHandler,

    // Workflow management
    StartWorkflowHandler,
    WorkflowJobCompletionHandler,
  ],
  controllers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {}
}
