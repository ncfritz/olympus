import { MetricsModule } from "@ncfritz/olympus-nest";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { OlympusApiModule } from "./api/OlympusApiModule";
import { EmailModule } from "./channels/email/EmailModule";
import { SynoChatModule } from "./channels/synochat/SynoChatModule";
import { WebSocketModule } from "./channels/websocket/WebSocketModule";
import { ALL_CONFIG, runtimeConfig } from "./config/configuration";
import type { RuntimeConfigType } from "./config/configuration";
import { RabbitModule } from "./infra/RabbitModule";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `${process.env.NODE_ENV}.env`,
      isGlobal: true,
      // Typed namespaces (config/configuration.ts); each validates the
      // environment when first injected. main.ts validates it up front.
      load: ALL_CONFIG,
    }),
    // /metrics (ADR 0017)
    MetricsModule.forRootAsync({
      inject: [runtimeConfig.KEY],
      useFactory: (runtime: RuntimeConfigType) => ({
        app: runtime.appName,
        environment: runtime.nodeEnv,
      }),
    }),
    RabbitModule,
    OlympusApiModule,
    // Delivery channels
    EmailModule,
    SynoChatModule,
    WebSocketModule,
  ],
})
export class AppModule {}
