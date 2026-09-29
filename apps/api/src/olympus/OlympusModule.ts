import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/AdminModule";
import { NotificationsModule } from "./notifications/NotificationsModule";
import { WeatherModule } from "./weather/WeatherModule";

/** Feature modules served under /olympus, in OpenAPI document order. */
export const OLYMPUS_MODULES = [
  AdminModule,
  NotificationsModule,
  WeatherModule,
];

@Module({ imports: OLYMPUS_MODULES })
export class OlympusModule {}
