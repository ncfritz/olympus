import { client as dionysusClient } from "@ncfritz/olympus-sdk/dionysus";
import { client as olympusClient } from "@ncfritz/olympus-sdk/olympus";
import { Global, Inject, Logger, Module, OnModuleInit } from "@nestjs/common";
import { olympusConfig } from "../config/configuration";
import type { OlympusConfigType } from "../config/configuration";
import { ContentApi } from "./ContentApi";
import { MediaApi } from "./MediaApi";
import { MetadataApi } from "./MetadataApi";
import { NotificationApi } from "./NotificationApi";

/**
 * The Olympus API, reached only through the SDK: configures the SDK
 * clients once from API_BASE_URL and provides the wrappers.
 */
@Global()
@Module({
  providers: [ContentApi, MediaApi, MetadataApi, NotificationApi],
  exports: [ContentApi, MediaApi, MetadataApi, NotificationApi],
})
export class OlympusApiModule implements OnModuleInit {
  constructor(
    @Inject(olympusConfig.KEY) private readonly olympus: OlympusConfigType,
  ) {}

  onModuleInit(): void {
    for (const client of [dionysusClient, olympusClient]) {
      client.setConfig({
        baseURL: this.olympus.apiBaseUrl,
        throwOnError: true,
      });
    }
    new Logger(OlympusApiModule.name).log(
      `Using the Olympus API at ${this.olympus.apiBaseUrl}`,
    );
  }
}
