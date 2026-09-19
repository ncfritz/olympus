import { Global, Module } from "@nestjs/common";
import { FetchJobs } from "./FetchJobs";
import { SqliteFetchJobCache } from "./SqliteFetchJobCache";

/** Metadata fetch jobs, cached locally in SQLite (DIONYSUS_CACHE_PATH). */
@Global()
@Module({
  providers: [SqliteFetchJobCache, FetchJobs],
  exports: [FetchJobs],
})
export class FetchJobsModule {}
