import { Module } from "@nestjs/common";
import { RabbitModule } from "../infra/RabbitModule";
import { WorkflowModule } from "../workflow/WorkflowModule";
import { CertificationsBatchHandler } from "./handlers/CertificationsBatchHandler";
import { CollectionsBatchHandler } from "./handlers/CollectionsBatchHandler";
import { CountriesBatchHandler } from "./handlers/CountriesBatchHandler";
import { GenresBatchHandler } from "./handlers/GenresBatchHandler";
import { KeywordsBatchHandler } from "./handlers/KeywordsBatchHandler";
import { LanguagesBatchHandler } from "./handlers/LanguagesBatchHandler";
import { MovieBatchHandler } from "./handlers/MovieBatchHandler";
import { PeopleBatchHandler } from "./handlers/PeopleBatchHandler";
import { ProductionCompaniesBatchHandler } from "./handlers/ProductionCompaniesBatchHandler";
import { RedriveBatchHandler } from "./handlers/RedriveBatchHandler";
import { TvNetworksBatchHandler } from "./handlers/TvNetworksBatchHandler";
import { TvSeriesBatchHandler } from "./handlers/TvSeriesBatchHandler";

/**
 * Batch jobs, one handler per job type: TMDB's daily ID exports and
 * reference lists, and redrives.
 */
@Module({
  // Publishes job completions; registers running jobs.
  imports: [RabbitModule, WorkflowModule],
  providers: [
    CertificationsBatchHandler,
    CollectionsBatchHandler,
    CountriesBatchHandler,
    GenresBatchHandler,
    KeywordsBatchHandler,
    LanguagesBatchHandler,
    MovieBatchHandler,
    PeopleBatchHandler,
    ProductionCompaniesBatchHandler,
    RedriveBatchHandler,
    TvNetworksBatchHandler,
    TvSeriesBatchHandler,
  ],
})
export class BatchModule {}
