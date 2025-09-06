import { MetadataFetchJob } from "@ncfritz/olympus-sdk/dionysus";
import lmdb, { Dbi, Env } from "node-lmdb";
import fs from "node:fs";
import { logger } from "../util/logger";
import { CacheManager } from "./CacheManager";

export interface LmdbCacheManagerProps {
  cacheLocation: string;
}

export class LmdbCacheManager implements CacheManager {
  private readonly cacheLocation: string;
  private env: Env;
  private db: Dbi;

  constructor(options: LmdbCacheManagerProps) {
    this.cacheLocation = options.cacheLocation;
  }

  async init() {
    if (!fs.existsSync(this.cacheLocation)) {
      logger.info(
        `Cache location does not exist... creating ${this.cacheLocation}`,
      );

      fs.mkdirSync(this.cacheLocation, { recursive: true });
    }

    this.env = new lmdb.Env();
    this.env.open({
      path: this.cacheLocation,
      mapSize: 256 * 1024 * 1024,
      maxDbs: 5,
      maxReaders: 100,
    });
    this.db = this.env.openDbi({ name: "job_cache", create: true });
  }

  async close(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
      } catch (e) {
        logger.error(`Unable to close database`, e);
      }
    }

    if (this.env) {
      try {
        this.env.close();
      } catch (e) {
        logger.error(`Unable to close database environment`, e);
      }
    }
  }

  async get(key: string) {
    const txn = this.env.beginTxn({ readOnly: true });
    let value: MetadataFetchJob | undefined = undefined;

    try {
      const cachedValue = txn.getString(this.db, key, { keyIsString: true });

      if (cachedValue) {
        value = JSON.parse(cachedValue) as MetadataFetchJob;
      } else {
        logger.debug(
          `Cache miss for entity "${key}", MetadataFetchJob will be retrieved from origin`,
        );
      }

      txn.commit();
    } catch (e) {
      logger.error(
        `Error fetching entity "${key}" from cache, falling back to origin`,
        e,
      );
      txn.abort();
    }

    return value;
  }

  async put(key: string, entry: MetadataFetchJob) {
    logger.debug(`Caching updated MetadataFetchJob for entity "${key}"`);

    const txn = this.env.beginTxn();

    try {
      txn.putString(this.db, key, JSON.stringify(entry), {
        keyIsString: true,
      });
      txn.commit();
    } catch (e) {
      logger.error(`Error persisting entity "${key}" to cache`, e);
      txn.abort();
    }
  }
}
