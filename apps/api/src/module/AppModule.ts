import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { RouterModule } from "@nestjs/core";
import { ReporterModule } from "nestjs-metrics-reporter";
import { PingController } from "../controller/PingController";
import {
  DionysusApiConfig,
  MinervaApiConfig,
  OlympusApiConfig,
} from "../schema/schemas";
import { Routes } from "../utils/routes";
import { BatchJobApiModule } from "./BatchJobApiModule";
import { ContentApiModule } from "./ContentApiModule";
import { GraphQLClientModule } from "./GraphQLClientModule";
import { MediaApiModule } from "./MediaApiModule";
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
    RouterModule.register([
      { path: Routes.OLYMPUS, module: NotificationsApiModule },
      { path: Routes.DIONYSUS, module: BatchJobApiModule },
      { path: Routes.DIONYSUS, module: ContentApiModule },
      { path: Routes.DIONYSUS, module: MediaApiModule },
      { path: Routes.DIONYSUS, module: MetadataApiModule },
      { path: Routes.DIONYSUS, module: WorkflowApiModule },
      { path: Routes.MINERVA, module: NotesApiModule },
      { path: Routes.MINERVA, module: MeetingApiModule },
    ]),
    // Infrastructure modules
    RabbitModule,
    GraphQLClientModule,
    // WebSockets
    WebSocketModule,
    // API Modules
    ...OlympusApiConfig.modules,
    ...DionysusApiConfig.modules,
    ...MinervaApiConfig.modules,
  ],
  exports: [],
  providers: [],
  controllers: [PingController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {}
}
