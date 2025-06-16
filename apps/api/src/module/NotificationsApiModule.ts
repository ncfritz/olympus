import { Module } from "@nestjs/common";
import { AcknowledgeNotificationController } from "../controller/notifications/AcknowledgeNotification";
import { CreateNotificationController } from "../controller/notifications/CreateNotification";
import { DeleteNotificationController } from "../controller/notifications/DeleteNotification";
import { GetUnreadNotificationCountController } from "../controller/notifications/GetUnreadNotificationCount";
import { ListNotificationGroupsController } from "../controller/notifications/ListNotificationGroups";
import { ListNotificationsController } from "../controller/notifications/ListNotifications";
import { ListNotificationSettingsController } from "../controller/notifications/ListNotificationSettings";
import { ListNotificationInGroupController } from "../controller/notifications/ListNotificationsInGroup";
import { ListNotificationTypesController } from "../controller/notifications/ListNotificationTypes";
import { SendNotificationController } from "../controller/notifications/SendNotification";
import { UpdateNotificationSettingController } from "../controller/notifications/UpdateNotificationSetting";
import { GraphQLClientModule } from "./GraphQLClientModule";
import { RabbitModule } from "./RabbitModule";
import { WebSocketModule } from "./WebSocketModule";

@Module({
  imports: [RabbitModule, GraphQLClientModule, WebSocketModule],
  exports: [],
  providers: [],
  controllers: [
    AcknowledgeNotificationController,
    CreateNotificationController,
    DeleteNotificationController,
    GetUnreadNotificationCountController,
    ListNotificationsController,
    ListNotificationInGroupController,
    ListNotificationGroupsController,
    ListNotificationSettingsController,
    ListNotificationTypesController,
    SendNotificationController,
    UpdateNotificationSettingController,
  ],
})
export class NotificationsApiModule {}
