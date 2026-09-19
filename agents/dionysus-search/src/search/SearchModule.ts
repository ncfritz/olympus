import { Module } from "@nestjs/common";
import { RabbitModule } from "../infra/RabbitModule";
import { MovieSearchHandler } from "./handlers/MovieSearchHandler";
import { TvEpisodeSearchHandler } from "./handlers/TvEpisodeSearchHandler";
import { TvSeasonSearchHandler } from "./handlers/TvSeasonSearchHandler";
import { TvSeriesSearchHandler } from "./handlers/TvSeriesSearchHandler";
import { NzbGeekClient } from "./services/NzbGeekClient";

/**
 * Searches, one handler per asset type: series fan out to seasons, seasons
 * to episodes; movies and episodes search the indexer.
 */
@Module({
  // Publishes searches.
  imports: [RabbitModule],
  providers: [
    NzbGeekClient,
    MovieSearchHandler,
    TvSeriesSearchHandler,
    TvSeasonSearchHandler,
    TvEpisodeSearchHandler,
  ],
})
export class SearchModule {}
