import { LiatNotificationSettingsResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { NotificationSettingService } from "../services/NotificationSettingService";

@Controller({ version: "1" })
export class ListNotificationSettingsController {
  constructor(
    private readonly notificationSettings: NotificationSettingService,
  ) {}

  @Get("/notifications/settings")
  @ApiOperation({
    summary: "Lists notification settings for a user",
    description:
      "Lists the notification settings a user has configured, across all channels.",
    operationId: "ListNotificationSettings",
    tags: ["Notifications"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: LiatNotificationSettingsResponse,
    description: "The notification settings were successfully fetched.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: LiatNotificationSettingsResponse = {
      notificationSettings: await this.notificationSettings.list(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
