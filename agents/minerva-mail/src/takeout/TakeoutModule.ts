import { OlympusClientModule } from "@ncfritz/olympus-client/nest";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import {
  ALL_CONFIG,
  olympusConfig,
  runtimeConfig,
} from "../config/configuration";
import type {
  OlympusConfigType,
  RuntimeConfigType,
} from "../config/configuration";
import { RabbitModule } from "../infra/RabbitModule";
import { MboxReader } from "../sources/takeout/MboxReader";
import { TakeoutParser } from "../sources/takeout/TakeoutParser";
import { TakeoutImport } from "./TakeoutImport";

/**
 * The Takeout import, as a command rather than part of the running agent:
 * an operator runs it from the workspace against an environment
 * (ADR 0030, as amended).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: ALL_CONFIG }),
    RabbitModule,
    // The environment's API, on its services listener: the import is an
    // agent's operation.
    OlympusClientModule.forRootAsync({
      inject: [olympusConfig.KEY, runtimeConfig.KEY],
      useFactory: (olympus: OlympusConfigType, runtime: RuntimeConfigType) => ({
        baseUrl: olympus.baseUrl,
        clientName: runtime.serviceName,
        tls: olympus.tls,
      }),
    }),
  ],
  providers: [
    { provide: MboxReader, useValue: new MboxReader() },
    { provide: TakeoutParser, useValue: new TakeoutParser() },
    TakeoutImport,
  ],
})
export class TakeoutModule {}
