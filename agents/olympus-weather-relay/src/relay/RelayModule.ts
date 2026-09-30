import { Module } from "@nestjs/common";
import { WeatherArchiveLineHandler } from "./handlers/WeatherArchiveLineHandler";

/** Prod's weather archive lines, into this environment (ADR 0025). */
@Module({
  providers: [WeatherArchiveLineHandler],
})
export class RelayModule {}
