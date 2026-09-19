import { Global, Module } from "@nestjs/common";
import { TmdbClient } from "./services/TmdbClient";

/** TMDB's API (TMDB_API_KEY). */
@Global()
@Module({
  providers: [TmdbClient],
  exports: [TmdbClient],
})
export class TmdbModule {}
