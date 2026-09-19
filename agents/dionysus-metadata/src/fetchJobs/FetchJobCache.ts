import type { MetadataFetchJob } from "@ncfritz/olympus-sdk/dionysus";

/** A local cache of metadata fetch jobs, keyed `<type>:<entity id>`. */
export interface FetchJobCache {
  get(key: string): Promise<MetadataFetchJob | undefined>;
  put(key: string, entry: MetadataFetchJob): Promise<void>;
}
