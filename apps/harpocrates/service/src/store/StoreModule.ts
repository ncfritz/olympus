import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./PrismaService";

/** The database, for every feature's store. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class StoreModule {}
