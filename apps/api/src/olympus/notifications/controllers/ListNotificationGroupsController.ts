import { ListNotificationGroupsResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  ParseBoolPipe,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
} from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";
import { NotificationGroupService } from "../services/NotificationGroupService";

@Controller({ version: "1" })
export class ListNotificationGroupsController {
  constructor(private readonly notificationGroups: NotificationGroupService) {}

  @Get("/notifications/groups")
  @ApiOperation({
    summary: "Lists current notification groups",
    description:
      "Lists all available notification groups.  This API does not enumerate or provide any information about the " +
      "number of notifications or notification status for the groups.",
    operationId: "ListNotificationGroups",
    tags: ["Notifications"],
  })
  @ApiQuery({
    name: "includeNotificationTypes",
    description:
      "When `true`, supported notification types information will be included with each group",
    type: Boolean,
    default: false,
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    type: ListNotificationGroupsResponse,
    description: "The notification group list has been fetched successfully.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query(
      "includeNotificationTypes",
      new DefaultValuePipe(false),
      ParseBoolPipe,
    )
    includeNotificationTypes: boolean,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: ListNotificationGroupsResponse = {
      groups: await this.notificationGroups.list(includeNotificationTypes),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
