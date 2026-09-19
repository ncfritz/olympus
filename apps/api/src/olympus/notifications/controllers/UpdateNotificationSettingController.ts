import {
  UpdateNotificationSettingRequest,
  UpdateNotificationSettingResponse,
} from "@ncfritz/olympus-model";
import { Body, Controller, HttpStatus, Param, Put, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { NotificationSettingService } from "../services/NotificationSettingService";

@Controller({ version: "1" })
export class UpdateNotificationSettingController {
  constructor(
    private readonly notificationSettings: NotificationSettingService,
  ) {}

  @Put("/notifications/settings/:notificationType")
  @ApiOperation({
    summary: "Creates or updates a single notification setting",
    description:
      "Creates or updates a single notification setting for a user.  This API will update the notification settings " +
      "for all notification channels supported by the notification settings.",
    operationId: "UpdateNotificationSetting",
    tags: ["Notifications"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "notificationType",
    type: String,
    description: "The notification type to set the channel settings for",
  })
  @ApiBody({
    type: UpdateNotificationSettingRequest,
    required: true,
    description: "Input for the CreateNotification operation",
  })
  @ApiOkResponse({
    type: UpdateNotificationSettingResponse,
    description: "The notification settings were successfully updated.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("notificationType") notificationTypeId: string,
    @Body() request: UpdateNotificationSettingRequest,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: UpdateNotificationSettingResponse = {
      notificationSetting: await this.notificationSettings.update(
        notificationTypeId,
        request.notificationSetting,
      ),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
