import { Module } from "@nestjs/common";
import { NotificationsGateway } from "../ws/gateway/NotificationsGateway";

@Module({
  exports: [NotificationsGateway],
  providers: [NotificationsGateway],
})
export class WebSocketModule {}
