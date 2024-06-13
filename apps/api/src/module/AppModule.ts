import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { PingController } from "../controller/PingController";
import { LoggerMiddleware } from "../middleware/LoggerMiddleware";
import { BatchJobApiModule } from "./BatchJobApiModule";
import { ContentApiModule } from "./ContentApiModule";
import { GraphQLClientModule } from "./GraphQLClientModule";
import { MeetingApiModule } from "./MeetingApiModule";
import { MetadataApiModule } from "./MetadataApiModule";
import { NotesApiModule } from "./NotesApiModule";
import { RabbitModule } from "./RabbitModule";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `${process.env.NODE_ENV}.env`,
      isGlobal: true,
    }),
    RabbitModule,
    GraphQLClientModule,
    BatchJobApiModule,
    ContentApiModule,
    MetadataApiModule,
    NotesApiModule,
    MeetingApiModule,
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
