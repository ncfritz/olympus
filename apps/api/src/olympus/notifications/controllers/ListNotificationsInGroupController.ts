import {
  ListNotificationsInGroupResponse,
  SortDirection,
} from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Param, Query, Res } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { type Response } from "express";
import {
  ApiPaginationParams,
  ApiStandardErrorResponses,
} from "../../../utils/controllerDecorators";
import { NotificationService } from "../services/NotificationService";

@Controller({ version: "1" })
export class ListNotificationsInGroupController {
  constructor(private readonly notifications: NotificationService) {}

  @Get("/notifications/group/:groupId/notifications")
  @ApiOperation({
    summary: "Lists the notifications in a notification group",
    description:
      "Lists the top `N` notifications and provides statistics for a specific notification group.  Notifications are " +
      "listed regardless of their acknowledged status.",
    operationId: "ListNotificationsInGroup",
    tags: ["Notifications"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "groupId",
    description: "The ID of the group to list notifications for.",
    type: String,
  })
  @ApiPaginationParams()
  @ApiOkResponse({
    type: ListNotificationsInGroupResponse,
    description: "The notification list has been fetched successfully.",
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("groupId") groupId: string,
    @Query("pageSize") pageSize = 10,
    @Query("startPage") startPage = 0,
    @Query("sort") sortDirection: SortDirection = SortDirection.DESC,
    @Query("sortBy") sortField = "createdTime",
    @Res() response: Response,
  ): Promise<void> {
    const { notifications, count } = await this.notifications.listInGroup(
      groupId,
      { pageSize, startPage, sortField, sortDirection },
    );

    const responseBody: ListNotificationsInGroupResponse = {
      notifications: notifications,
      count: count,
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
