import { MetadataFetchJob } from "@ncfritz/olympus-model";

export interface CacheManager {
  init(): Promise<void>;
  close(): Promise<void>;
  get(key: string): Promise<MetadataFetchJob | undefined>;
  put(key: string, entry: MetadataFetchJob): Promise<void>;
}
