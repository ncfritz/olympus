import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ReporterModule } from "nestjs-metrics-reporter";
import { PingController } from "../controller/PingController";
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
  configure(consumer: MiddlewareConsumer) {}
}
