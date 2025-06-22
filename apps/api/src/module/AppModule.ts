import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { DevtoolsModule } from "@nestjs/devtools-integration";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";
import { PingController } from "../controller/PingController";
import { LoggerMiddleware } from "../middleware/LoggerMiddleware";
import { BatchJobApiModule } from "./BatchJobApiModule";
import { ContentApiModule } from "./ContentApiModule";
import { GraphQLClientModule } from "./GraphQLClientModule";
import { MeetingApiModule } from "./MeetingApiModule";
import { MetadataApiModule } from "./MetadataApiModule";
import { NotesApiModule } from "./NotesApiModule";
import { NotificationsApiModule } from "./NotificationsApiModule";
import { RabbitModule } from "./RabbitModule";
import { ConfigModule } from "@nestjs/config";
import { WebSocketModule } from "./WebSocketModule";
import { WorkflowApiModule } from "./WorkflowApiModule";
import { appName } from "../utils/logger";

@Module({
  imports: [
    DevtoolsModule.register({
      http: process.env.NODE_ENV !== "production",
      port: 13000,
    }),
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
    GraphQLClientModule,
    BatchJobApiModule,
    ContentApiModule,
    MetadataApiModule,
    NotesApiModule,
    NotificationsApiModule,
    MeetingApiModule,
    WebSocketModule,
    WorkflowApiModule,
  ],
  exports: [],
  providers: [],
  controllers: [PingController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}
