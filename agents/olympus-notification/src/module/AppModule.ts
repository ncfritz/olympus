import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";
import { GoogleMailHandler } from "../handler/gmailHandler";
import { SynologyChatHandler } from "../handler/synologyChatHandler";
import { SynologyEmailHandler } from "../handler/synologyEmailHandler";
import { WebSocketHandler } from "../handler/websocketHandler";
import { RabbitModule } from "./RabbitModule";
import { appName } from "../util/logger";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `${process.env.NODE_ENV}.env`,
      isGlobal: true,
    }),
    PrometheusModule.register({
      defaultLabels: {
        app: appName,
      },
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
