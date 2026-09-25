import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ALL_CONFIG } from "./config/configuration";
import { MetricsModule } from "./metrics/MetricsModule";
import { StoreModule } from "./store/StoreModule";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Typed namespaces (config/configuration.ts); the environment comes
      // from the process (`--env-file=dev.env`), validated by main.ts.
      ignoreEnvFile: true,
      load: ALL_CONFIG,
    }),
    MetricsModule,
    StoreModule,
  ],
})
export class AppModule {}
