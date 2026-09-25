import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

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
  /**
   * The last shutdown phase, so work that services let finish in
   * onModuleDestroy or beforeApplicationShutdown still has the database.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
