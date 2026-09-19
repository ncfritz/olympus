import { ListNotificationTypesResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { NotificationTypeService } from "../services/NotificationTypeService";

@Controller({ version: "1" })
export class ListNotificationTypesController {
  constructor(private readonly notificationTypes: NotificationTypeService) {}

  @Get("/notifications/types")
  @ApiOperation({
    summary: "Lists notifications types",
    description:
      "Lists currently supported notification types.  This API returns the full set of notifications supported " +
      "and the supported, and default enabled, notification channels for each.",
    operationId: "ListNotificationsTypes",
    tags: ["Notifications"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: ListNotificationTypesResponse,
    description: "The notification type list has been fetched successfully.",
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: ListNotificationTypesResponse = {
      notificationTypes: await this.notificationTypes.list(),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
