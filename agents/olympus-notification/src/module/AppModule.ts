import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ReporterModule } from "nestjs-metrics-reporter";
import { GoogleMailHandler } from "../handler/gmailHandler";
import { SynologyChatHandler } from "../handler/synologyChatHandler";
import { SynologyEmailHandler } from "../handler/synologyEmailHandler";
import { WebSocketHandler } from "../handler/websocketHandler";
import { appName } from "../util/logger";
import { RabbitModule } from "./RabbitModule";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `${process.env.NODE_ENV}.env`,
      isGlobal: true,
    }),
    ReporterModule.forRootAsync({
      useFactory: () => ({
        defaultMetricsEnabled: true,
        defaultLabels: {
          app: appName,
          environment: process.env.NODE_ENV!,
        },
      }),
    }),
    RabbitModule,
  ],
  exports: [],
  providers: [
    SynologyChatHandler,
    SynologyEmailHandler,
    WebSocketHandler,
    GoogleMailHandler,
  ],
  controllers: [],
})
export class AppModule implements NestModule {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  configure(consumer: MiddlewareConsumer) {}
}
