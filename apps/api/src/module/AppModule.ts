import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { LoggerMiddleware } from "../middleware/LoggerMiddleware";
import { BatchJobApiModule } from "./BatchJobApiModule";
import { ContentApiModule } from "./ContentApiModule";
import { GraphQLClientModule } from "./GraphQLClientModule";
import { MeetingApiModule } from "./MeetingApiModule";
import { MetadataApiModule } from "./MetadataApiModule";
import { NotesApiModule } from "./NotesApiModule";
import { RabbitModule } from "./RabbitModule";

@Module({
  imports: [
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
  controllers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}
