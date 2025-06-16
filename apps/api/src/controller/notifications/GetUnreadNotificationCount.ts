import { GetUnreadNotificationCountResponse } from "@ncfritz/olympus-model/dist/notifications";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { Response } from "express";
import { GraphQLClient } from "graphql-request";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";
import { BaseNotificationsController } from "./BaseNotificationsController";

@Controller()
export class GetUnreadNotificationCountController extends BaseNotificationsController {
  constructor(private readonly graphQLClient: GraphQLClient) {
    super();
  }

  @Get("/v1/notifications/unreadCount")
  @ApiOperation({
    summary: "Gets the current unread notifications count",
    description:
      "Gets the number of unread notifications for the user regardless of what channel they are in.",
    operationId: "GetUnreadNotificationCount",
    tags: ["Notifications"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The notification count has been fetched successfully.",
    type: GetUnreadNotificationCountResponse,
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const responseBody: GetUnreadNotificationCountResponse = {
      unreadCount: await this.getUnreadNotificationsCount(this.graphQLClient),
    };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
