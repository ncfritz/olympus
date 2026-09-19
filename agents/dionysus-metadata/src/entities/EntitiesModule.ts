import { Module } from "@nestjs/common";
import { CollectionMetadataHandler } from "./handlers/CollectionMetadataHandler";
import { MovieMetadataHandler } from "./handlers/MovieMetadataHandler";
import { PersonMetadataHandler } from "./handlers/PersonMetadataHandler";
import { ProductionCompanyMetadataHandler } from "./handlers/ProductionCompanyMetadataHandler";
import { TvEpisodeMetadataHandler } from "./handlers/TvEpisodeMetadataHandler";
import { TvNetworkMetadataHandler } from "./handlers/TvNetworkMetadataHandler";
import { TvSeasonMetadataHandler } from "./handlers/TvSeasonMetadataHandler";
import { TvSeriesMetadataHandler } from "./handlers/TvSeriesMetadataHandler";

/**
 * Entity fetches, one handler per entity type: TMDB's details mapped to
 * the API's entities, and each entity's refresh policy.
 */
@Module({
  providers: [
    CollectionMetadataHandler,
    MovieMetadataHandler,
    PersonMetadataHandler,
    ProductionCompanyMetadataHandler,
    TvEpisodeMetadataHandler,
    TvNetworkMetadataHandler,
    TvSeasonMetadataHandler,
    TvSeriesMetadataHandler,
  ],
})
export class EntitiesModule {}
