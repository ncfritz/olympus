import { Module } from "@nestjs/common";
import { RabbitModule } from "../../infra/RabbitModule";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { NotificationService } from "./services/NotificationService";
import { NotificationGroupService } from "./services/NotificationGroupService";
import { NotificationSettingService } from "./services/NotificationSettingService";
import { NotificationTypeService } from "./services/NotificationTypeService";
import { NotificationsGatewayModule } from "./gateway/NotificationsGatewayModule";
import { AcknowledgeNotificationController } from "./controllers/AcknowledgeNotificationController";
import { CreateNotificationController } from "./controllers/CreateNotificationController";
import { DeleteNotificationController } from "./controllers/DeleteNotificationController";
import { GetUnreadNotificationCountController } from "./controllers/GetUnreadNotificationCountController";
import { ListNotificationGroupsController } from "./controllers/ListNotificationGroupsController";
import { ListNotificationSettingsController } from "./controllers/ListNotificationSettingsController";
import { ListNotificationTypesController } from "./controllers/ListNotificationTypesController";
import { ListNotificationsController } from "./controllers/ListNotificationsController";
import { ListNotificationsInGroupController } from "./controllers/ListNotificationsInGroupController";
import { SendNotificationController } from "./controllers/SendNotificationController";
import { UpdateNotificationSettingController } from "./controllers/UpdateNotificationSettingController";

@Module({
  imports: [RabbitModule, GraphQLClientModule, NotificationsGatewayModule],
  providers: [
    NotificationService,
    NotificationGroupService,
    NotificationSettingService,
    NotificationTypeService,
  ],
  controllers: [
    AcknowledgeNotificationController,
    CreateNotificationController,
    DeleteNotificationController,
    GetUnreadNotificationCountController,
    ListNotificationGroupsController,
    ListNotificationSettingsController,
    ListNotificationTypesController,
    ListNotificationsController,
    ListNotificationsInGroupController,
    SendNotificationController,
    UpdateNotificationSettingController,
  ],
})
export class NotificationsModule {}
