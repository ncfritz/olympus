import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { CalendarsModule } from "./calendars/calendars.module";
import { EventsModule } from "./events/events.module";
import { StoreModule } from "./store/store.module";
import { SyncModule } from "./sync/sync.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StoreModule,
    SyncModule,
    EventsModule,
    CalendarsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
