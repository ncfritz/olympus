import { Module } from "@nestjs/common";
import { NotificationsGateway } from "./NotificationsGateway";

@Module({
  exports: [NotificationsGateway],
  providers: [NotificationsGateway],
})
export class NotificationsGatewayModule {}
