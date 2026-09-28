import { Module } from "@nestjs/common";
import { AuthModule } from "../../../auth/AuthModule";
import { NotificationsGateway } from "./NotificationsGateway";

@Module({
  // For UserIdentityService: the gateway authenticates its connections with the
  // same token verification the HTTP guard uses.
  imports: [AuthModule],
  exports: [NotificationsGateway],
  providers: [NotificationsGateway],
})
export class NotificationsGatewayModule {}
