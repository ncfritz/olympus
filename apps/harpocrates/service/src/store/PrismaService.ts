import { Inject, Injectable, OnApplicationShutdown } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import {
  databaseConfig,
  type DatabaseConfigType,
} from "../config/configuration";

/**
 * The service's database. Prisma connects on the first query, so the
 * process starts, and /health answers, while harpocrates-postgres is still
 * coming up; the stores see the error instead.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnApplicationShutdown
{
  /** The URL from the configuration, which may have read it from a file. */
  constructor(@Inject(databaseConfig.KEY) database: DatabaseConfigType) {
    super({ datasources: { db: { url: database.url } } });
  }

  /**
   * The last shutdown phase, so work that services let finish in
   * onModuleDestroy or beforeApplicationShutdown still has the database.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
