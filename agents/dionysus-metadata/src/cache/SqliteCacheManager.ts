import { MetadataFetchJob } from "@ncfritz/olympus-model";
import fs from "node:fs";
import { logger } from "../util/logger";
import { CacheManager } from "./CacheManager";
import DatabaseConstructor, { Database, Statement } from "better-sqlite3";

export interface SqliteCacheManagerProps {
  cacheLocation: string;
}

export class SqliteCacheManager implements CacheManager {
  private readonly cacheLocation: string;
  private db: Database;
  private selectStatement: Statement<[string], { v: string }>;
  private upsertStatement: Statement<[string, string]>;
  private upsert: (key: string, value: MetadataFetchJob) => void;

  constructor(options: SqliteCacheManagerProps) {
    this.cacheLocation = options.cacheLocation;
  }

  async init() {
    if (!fs.existsSync(this.cacheLocation)) {
      logger.info(
        `Cache location does not exist... creating ${this.cacheLocation}`,
      );

      fs.mkdirSync(this.cacheLocation, { recursive: true });
    }

    try {
      this.db = new DatabaseConstructor(`${this.cacheLocation}/jobCache.db`);
      this.db.exec(
        `CREATE TABLE IF NOT EXISTS fetch_jobs_cache (
             k TEXT PRIMARY KEY,
             v TEXT NOT NULL
           )`,
      );

      this.selectStatement = this.db.prepare(
        `SELECT v FROM fetch_jobs_cache WHERE k=?`,
      );
      this.upsertStatement = this.db.prepare<[string, string]>(
        `INSERT INTO fetch_jobs_cache (k, v)
         VALUES (?, ?)
         ON CONFLICT(k) DO UPDATE SET v=excluded.v`,
      );
      this.upsert = this.db.transaction<
        (key: string, value: MetadataFetchJob) => void
      >((key, value) => {
        this.upsertStatement.run(key, JSON.stringify(value));
      });
    } catch (e) {
      logger.error("Could not initialize SQLite database for cache.", e);
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
      } catch (e) {
        logger.error(`Unable to close database`, e);
      }
    }
  }

  async get(key: string): Promise<MetadataFetchJob | undefined> {
    let value: MetadataFetchJob | undefined = undefined;

    try {
      const cachedValue = this.selectStatement.get(key);

      if (cachedValue && cachedValue.v) {
        value = JSON.parse(cachedValue.v) as MetadataFetchJob;
      } else {
        logger.debug(
          `Cache miss for entity "${key}", MetadataFetchJob will be retrieved from origin`,
        );
      }
    } catch (e) {
      logger.error(
        `Error fetching entity "${key}" from cache, falling back to origin`,
        e,
      );
    }

    return value;
  }

  async put(key: string, entry: MetadataFetchJob): Promise<void> {
    logger.debug(`Caching updated MetadataFetchJob for entity "${key}"`);

    try {
      this.upsert(key, entry);
    } catch (e) {
      logger.error(`Error persisting entity "${key}" to cache`, e);
    }
  }
}
