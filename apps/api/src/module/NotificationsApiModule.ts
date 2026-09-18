import { Module } from "@nestjs/common";
import { AcknowledgeNotificationController } from "../controller/olympus/notifications/AcknowledgeNotification";
import { CreateNotificationController } from "../controller/olympus/notifications/CreateNotification";
import { DeleteNotificationController } from "../controller/olympus/notifications/DeleteNotification";
import { GetUnreadNotificationCountController } from "../controller/olympus/notifications/GetUnreadNotificationCount";
import { ListNotificationGroupsController } from "../controller/olympus/notifications/ListNotificationGroups";
import { ListNotificationsController } from "../controller/olympus/notifications/ListNotifications";
import { ListNotificationSettingsController } from "../controller/olympus/notifications/ListNotificationSettings";
import { ListNotificationsInGroupController } from "../controller/olympus/notifications/ListNotificationsInGroup";
import { ListNotificationTypesController } from "../controller/olympus/notifications/ListNotificationTypes";
import { SendNotificationController } from "../controller/olympus/notifications/SendNotification";
import { UpdateNotificationSettingController } from "../controller/olympus/notifications/UpdateNotificationSetting";
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
    ListNotificationsInGroupController,
    ListNotificationGroupsController,
    ListNotificationSettingsController,
    ListNotificationTypesController,
    SendNotificationController,
    UpdateNotificationSettingController,
  ],
})
export class NotificationsApiModule {}
