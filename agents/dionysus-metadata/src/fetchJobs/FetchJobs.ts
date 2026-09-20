import { Injectable } from "@nestjs/common";
import { JobApi } from "@ncfritz/olympus-client";
import { FetchJobStore, type FetchJobStoreOptions } from "./FetchJobStore";
import { SqliteFetchJobCache } from "./SqliteFetchJobCache";

/** Opens fetch job stores over the process's cache. */
@Injectable()
export class FetchJobs {
  constructor(
    private readonly cache: SqliteFetchJobCache,
    private readonly jobApi: JobApi,
  ) {}

  /** @throws when the cache can't be opened (see SqliteFetchJobCache) */
  async store(options: FetchJobStoreOptions): Promise<FetchJobStore> {
    await this.cache.open();
    return new FetchJobStore(this.cache, this.jobApi, options);
  }
}
