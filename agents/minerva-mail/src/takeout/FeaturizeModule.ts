import { OlympusClientModule } from "@ncfritz/olympus-client/nest";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ClassifierClient } from "../classifier/ClassifierClient";
import {
  ALL_CONFIG,
  olympusConfig,
  runtimeConfig,
} from "../config/configuration";
import type {
  OlympusConfigType,
  RuntimeConfigType,
} from "../config/configuration";
import { MboxReader } from "../sources/takeout/MboxReader";
import { TakeoutParser } from "../sources/takeout/TakeoutParser";
import { TakeoutFeaturize } from "./TakeoutFeaturize";

/**
 * Featurizing a Takeout archive, as a command: the API for the account,
 * the classifier for the text. No broker: nothing is published.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: ALL_CONFIG }),
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
    ClassifierClient,
    TakeoutFeaturize,
  ],
})
export class FeaturizeModule {}
