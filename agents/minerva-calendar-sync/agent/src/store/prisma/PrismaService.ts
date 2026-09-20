import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * The last shutdown phase, so work that services let finish in
   * onModuleDestroy or beforeApplicationShutdown still has the database.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
