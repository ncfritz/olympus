import { ListNotificationsResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  ParseIntPipe,
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
import { NotificationService } from "../services/NotificationService";

@Controller({ version: "1" })
export class ListNotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get("/notifications")
  @ApiOperation({
    summary: "Lists current notifications and statistics",
    description:
      "Lists the top `N` notifications and provides statistics for all notification groups.  Notifications are " +
      "listed regardless of their group or acknowledged status.  For all notification groups, a entry containing the " +
      "number of unread notifications as well as a breakdown of notification count by status will be provided.",
    operationId: "ListNotifications",
    tags: ["Notifications"],
  })
  @ApiProduces("application/json")
  @ApiQuery({
    name: "count",
    description:
      "The number of notifications to fetch for the initial list view",
    type: Number,
    default: 10,
  })
  @ApiOkResponse({
    type: ListNotificationsResponse,
    description: "The notification list has been fetched successfully.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Query("count", new DefaultValuePipe(10), ParseIntPipe) count: number,
    @Res() response: Response,
  ): Promise<void> {
    const { notifications, statistics } = await this.notifications.list(count);

    const responseBody: ListNotificationsResponse = {
      recent: notifications,
      statistics: statistics,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
