import { Logger, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ReporterModule } from "nestjs-metrics-reporter";
import { MovieSearchFanoutHandler } from "../handler/fanout/MovieSearchFanoutHandler";
import { TVSeasonSearchFanoutHandler } from "../handler/fanout/TVSeasonSearchFanoutHandler";
import { TVSeriesSearchFanoutHandler } from "../handler/fanout/TVSeriesSearchFanoutHandler";
import { MovieSearchHandler } from "../handler/search/MovieSearchHandler";
import { TVEpisodeSearchHandler } from "../handler/search/TVEpisodeSearchHandler";
import { TVSeasonSearchHandler } from "../handler/search/TVSeasonSearchHandler";
import { TVSeriesSearchHandler } from "../handler/search/TVSeriesSearchHandler";
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
    // Logging
    Logger,

    // Fanout Jobs
    MovieSearchFanoutHandler,
    TVSeriesSearchFanoutHandler,
    TVSeasonSearchFanoutHandler,

    // Search Jobs
    MovieSearchHandler,
    TVSeriesSearchHandler,
    TVSeasonSearchHandler,
    TVEpisodeSearchHandler,
  ],
  controllers: [],
})
export class AppModule implements NestModule {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  configure(consumer: MiddlewareConsumer) {}
}
